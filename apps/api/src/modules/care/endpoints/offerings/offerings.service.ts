import { BadRequestException, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ERROR_CODES } from '../../../../common/error-codes';
import { parsePagination, paginate, Paginated } from '../../../../common/pagination';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CareOrdersService } from '../../care-orders.service';
import { CANCEL_RULES, PRICING_TYPES, SERVICE_TYPES, requireContactVerified, validateAvailabilities, validatePricing } from '../../care-state';
import { toOfferingSummary, OfferingSummaryView } from '../../care-view';

export interface CreateOfferingInput {
  serviceType: string;
  title: string;
  description: string;
  areaCode: string;
  radiusKm?: number;
  pricingType: string;
  priceMinor?: number;
  cancelRule: string;
  status?: 'DRAFT' | 'PUBLISHED';
  availabilities: { startAt: string; endAt: string; capacity?: number }[];
}

export interface ListOfferingsQuery {
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
 * GET/POST /api/v1/care/offerings — 契约：docs/modules/care/offerings.md
 * 公开列表只出 PUBLISHED；mine=true 需登录，返回本人全状态。
 */
@Injectable()
export class OfferingsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CareOrdersService) private readonly orders: CareOrdersService,
  ) {}

  async list(query: ListOfferingsQuery, viewerId?: string): Promise<Paginated<OfferingSummaryView>> {
    const { page, pageSize, skip, take } = parsePagination(query);
    const mine = query.mine === 'true';
    if (mine && !viewerId) {
      throw new UnauthorizedException({ code: ERROR_CODES.AUTH_REQUIRED, message: '查看我的服务需要登录' });
    }
    if (query.serviceType && !(SERVICE_TYPES as readonly string[]).includes(query.serviceType)) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: 'serviceType 不合法' });
    }
    if (query.pricingType && !(PRICING_TYPES as readonly string[]).includes(query.pricingType)) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: 'pricingType 不合法' });
    }

    const where: Prisma.CareOfferingWhereInput = {
      status: mine ? undefined : 'PUBLISHED',
      ...(mine ? { providerUserId: viewerId } : {}),
      ...(query.areaCode ? { areaCode: query.areaCode } : {}),
      ...(query.serviceType ? { serviceType: query.serviceType } : {}),
      ...(query.pricingType ? { pricingType: query.pricingType } : {}),
    };
    const dateFrom = query.dateFrom ? new Date(query.dateFrom) : null;
    const dateTo = query.dateTo ? new Date(query.dateTo) : null;
    if (dateFrom || dateTo) {
      where.availabilities = {
        some: {
          ...(dateFrom ? { endAt: { gte: dateFrom } } : {}),
          ...(dateTo ? { startAt: { lte: dateTo } } : {}),
        },
      };
    }

    const [total, rows] = await Promise.all([
      this.prisma.careOffering.count({ where }),
      this.prisma.careOffering.findMany({
        where,
        include: { provider: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);
    const trust = await this.orders.trustSummaries(rows.map((r) => r.providerUserId));
    const items = rows.map((r) => toOfferingSummary(r, trust.get(r.providerUserId)!));
    return paginate(items, page, pageSize, total);
  }

  async create(providerUserId: string, input: CreateOfferingInput): Promise<OfferingSummaryView> {
    if (requireContactVerified()) {
      const profile = await this.prisma.userPrivateProfile.findUnique({
        where: { userId: providerUserId },
        select: { phoneVerifiedAt: true, emailVerifiedAt: true },
      });
      if (!profile?.phoneVerifiedAt && !profile?.emailVerifiedAt) {
        throw new ForbiddenException({
          code: ERROR_CODES.PHONE_VERIFICATION_REQUIRED,
          message: '发布服务前需先完成邮箱验证（或手机号验证）',
        });
      }
    }
    const pricingError = validatePricing(input.pricingType, input.priceMinor);
    if (pricingError) throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: pricingError });
    if (!(CANCEL_RULES as readonly string[]).includes(input.cancelRule)) {
      throw new BadRequestException({
        code: ERROR_CODES.REQUEST_VALIDATION_FAILED,
        message: `cancelRule 需为 ${CANCEL_RULES.join('/')}`,
      });
    }
    const availabilityError = validateAvailabilities(input.availabilities);
    if (availabilityError) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: availabilityError });
    }

    const offering = await this.prisma.careOffering.create({
      data: {
        providerUserId,
        serviceType: input.serviceType,
        title: input.title,
        description: input.description,
        areaCode: input.areaCode,
        radiusKm: input.radiusKm ?? null,
        pricingType: input.pricingType,
        priceMinor: input.priceMinor === undefined ? null : BigInt(input.priceMinor),
        cancelRule: input.cancelRule,
        status: input.status ?? 'PUBLISHED',
        availabilities: {
          create: input.availabilities.map((slot) => ({
            startAt: new Date(slot.startAt),
            endAt: new Date(slot.endAt),
            capacity: slot.capacity ?? 1,
          })),
        },
      },
      include: { provider: true },
    });
    const trust = await this.orders.trustSummaries([providerUserId]);
    return toOfferingSummary(offering, trust.get(providerUserId)!);
  }
}
