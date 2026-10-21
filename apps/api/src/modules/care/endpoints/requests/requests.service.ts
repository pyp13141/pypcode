import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { encryptSensitive } from '../../../../common/crypto/sensitive-crypto';
import { ERROR_CODES } from '../../../../common/error-codes';
import { Paginated, paginate, parsePagination } from '../../../../common/pagination';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  CANCEL_RULES,
  PRICING_TYPES,
  SERVICE_TYPES,
  requireContactVerified,
  validatePricing,
} from '../../care-state';
import { PetBriefView, RequestView, toRequestView } from '../../care-view';

export interface CreateRequestInput {
  petIds: string[];
  serviceType: string;
  title: string;
  description: string;
  areaCode: string;
  startAt: string;
  endAt: string;
  frequency?: string;
  pricingType: string;
  priceMinor?: number;
  cancelRule: string;
  emergencyContact?: string;
  status?: 'DRAFT' | 'PUBLISHED';
}

export interface ListRequestsQuery {
  areaCode?: string;
  serviceType?: string;
  dateFrom?: string;
  dateTo?: string;
  pricingType?: string;
  mine?: string;
  page?: string;
  pageSize?: string;
}

/**
 * GET/POST /api/v1/care/requests — 契约：docs/modules/care/requests.md
 * 公开视图只有 areaCode/宠物摘要，绝不含精确地址/门禁/紧急联系人（产品 5.1.3）。
 */
@Injectable()
export class RequestsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(query: ListRequestsQuery, viewerId?: string): Promise<Paginated<RequestView>> {
    const { page, pageSize, skip, take } = parsePagination(query);
    const mine = query.mine === 'true';
    if (mine && !viewerId) {
      throw new UnauthorizedException({ code: ERROR_CODES.AUTH_REQUIRED, message: '查看我的需求需要登录' });
    }
    if (query.serviceType && !(SERVICE_TYPES as readonly string[]).includes(query.serviceType)) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: 'serviceType 不合法' });
    }

    const where: Prisma.CareRequestWhereInput = {
      status: mine ? undefined : 'PUBLISHED',
      ...(mine ? { requesterUserId: viewerId } : {}),
      ...(query.areaCode ? { areaCode: query.areaCode } : {}),
      ...(query.serviceType ? { serviceType: query.serviceType } : {}),
      ...(query.pricingType ? { pricingType: query.pricingType } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            ...(query.dateFrom ? { endAt: { gte: new Date(query.dateFrom) } } : {}),
            ...(query.dateTo ? { startAt: { lte: new Date(query.dateTo) } } : {}),
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.careRequest.count({ where }),
      this.prisma.careRequest.findMany({
        where,
        include: { requester: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);
    const pets = await this.petBriefs(rows.flatMap((r) => r.petIds));
    const items = rows.map((r) =>
      toRequestView(
        r,
        r.requester,
        r.petIds.map((id) => pets.get(id)).filter((p): p is PetBriefView => p !== undefined),
        viewerId === r.requesterUserId,
      ),
    );
    return paginate(items, page, pageSize, total);
  }

  /**
   * GET /care/requests/:id — 契约：docs/modules/care/request-by-id.md
   * 公开：仅 PUBLISHED 可见；本人可见全状态；其余 404 不泄露存在性。
   * 2026-10-11 补口：客户端需求详情页依赖（UX-REVIEW P0-2 需求列表/详情闭环）。
   */
  async getById(requestId: string, viewerId?: string): Promise<RequestView> {
    const request = await this.prisma.careRequest.findUnique({
      where: { id: requestId },
      include: { requester: true },
    });
    const isOwner = !!viewerId && request?.requesterUserId === viewerId;
    if (!request || (!isOwner && request.status !== 'PUBLISHED')) {
      throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '需求不存在' });
    }
    const pets = await this.petBriefs(request.petIds);
    return toRequestView(
      request,
      request.requester,
      request.petIds.map((id) => pets.get(id)).filter((p): p is PetBriefView => p !== undefined),
      isOwner,
    );
  }

  async create(requesterUserId: string, input: CreateRequestInput): Promise<RequestView> {
    if (requireContactVerified()) {
      const profile = await this.prisma.userPrivateProfile.findUnique({
        where: { userId: requesterUserId },
        select: { phoneVerifiedAt: true, emailVerifiedAt: true },
      });
      if (!profile?.phoneVerifiedAt && !profile?.emailVerifiedAt) {
        throw new ForbiddenException({
          code: ERROR_CODES.PHONE_VERIFICATION_REQUIRED,
          message: '发布需求前需先完成邮箱验证（或手机号验证）',
        });
      }
    }

    // 宠物档案校验：必须属于本人且未归档（服务快照来源，API §3）
    const pets = await this.prisma.pet.findMany({
      where: { id: { in: input.petIds }, ownerUserId: requesterUserId, archivedAt: null },
      select: { id: true },
    });
    if (pets.length !== input.petIds.length) {
      throw new BadRequestException({
        code: ERROR_CODES.REQUEST_VALIDATION_FAILED,
        message: 'petIds 需为本人未归档的宠物档案（1-5 只）',
      });
    }

    const startAt = new Date(input.startAt);
    const endAt = new Date(input.endAt);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: '时间窗不合法（endAt 必须晚于 startAt）' });
    }
    if (endAt <= new Date()) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: '需求时间窗已过期' });
    }
    const pricingError = validatePricing(input.pricingType, input.priceMinor);
    if (pricingError) throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: pricingError });
    if (!(CANCEL_RULES as readonly string[]).includes(input.cancelRule)) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: `cancelRule 需为 ${CANCEL_RULES.join('/')}` });
    }

    const request = await this.prisma.careRequest.create({
      data: {
        requesterUserId,
        serviceType: input.serviceType,
        title: input.title,
        description: input.description,
        areaCode: input.areaCode,
        startAt,
        endAt,
        frequency: input.frequency ?? null,
        petIds: input.petIds,
        pricingType: input.pricingType,
        priceMinor: input.priceMinor === undefined ? null : BigInt(input.priceMinor),
        cancelRule: input.cancelRule,
        emergencyContactEncrypted: input.emergencyContact ? encryptSensitive(input.emergencyContact) : null,
        status: input.status ?? 'PUBLISHED',
      },
      include: { requester: true },
    });
    const briefs = await this.petBriefs(request.petIds);
    return toRequestView(
      request,
      request.requester,
      request.petIds.map((id) => briefs.get(id)).filter((p): p is PetBriefView => p !== undefined),
      true,
    );
  }

  /** 公共宠物摘要（只出公开安全字段） */
  private async petBriefs(petIds: string[]): Promise<Map<string, PetBriefView>> {
    const unique = [...new Set(petIds)];
    if (unique.length === 0) return new Map();
    const rows = await this.prisma.pet.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true, species: true, breed: true, archivedAt: true },
    });
    return new Map(
      rows.map((p) => [p.id, { id: p.id, name: p.archivedAt ? `${p.name}（已归档）` : p.name, species: p.species, breed: p.breed }]),
    );
  }
}
