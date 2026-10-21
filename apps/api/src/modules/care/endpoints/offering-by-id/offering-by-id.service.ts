import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ERROR_CODES } from '../../../../common/error-codes';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CareOrdersService } from '../../care-orders.service';
import {
  CANCEL_RULES,
  OFFERING_TRANSITIONS,
  PRICING_TYPES,
  validateAvailabilities,
  validatePricing,
} from '../../care-state';
import { OfferingDetailView, toOfferingDetail } from '../../care-view';

export interface PatchOfferingInput {
  title?: string;
  description?: string;
  areaCode?: string;
  radiusKm?: number | null;
  pricingType?: string;
  priceMinor?: number | null;
  cancelRule?: string;
  status?: 'PUBLISHED' | 'PAUSED' | 'ARCHIVED';
  availabilities?: { startAt: string; endAt: string; capacity?: number }[];
}

/**
 * GET/PATCH /api/v1/care/offerings/:id — 契约：docs/modules/care/offering-by-id.md
 * GET 公开仅 PUBLISHED，其余状态仅 owner 可见；PATCH 仅 owner，状态流转按 OFFERING_TRANSITIONS。
 */
@Injectable()
export class OfferingByIdService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CareOrdersService) private readonly orders: CareOrdersService,
  ) {}

  async get(offeringId: string, viewerId?: string): Promise<OfferingDetailView> {
    const offering = await this.prisma.careOffering.findUnique({
      where: { id: offeringId },
      include: { provider: true, availabilities: { orderBy: { startAt: 'asc' } } },
    });
    const isOwner = offering !== null && viewerId === offering.providerUserId;
    if (!offering || (!isOwner && offering.status !== 'PUBLISHED')) {
      throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '服务公告不存在' });
    }
    const trust = await this.orders.trustSummaries([offering.providerUserId]);
    return toOfferingDetail(offering, trust.get(offering.providerUserId)!, isOwner);
  }

  async patch(offeringId: string, userId: string, input: PatchOfferingInput): Promise<OfferingDetailView> {
    const offering = await this.prisma.careOffering.findUnique({
      where: { id: offeringId },
      include: { availabilities: true },
    });
    if (!offering || offering.providerUserId !== userId) {
      throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '服务公告不存在' });
    }
    if (offering.status === 'REMOVED') {
      throw new ForbiddenException({ code: ERROR_CODES.RESOURCE_FORBIDDEN, message: '已被审核下架的公告不可修改' });
    }

    // 合并后的有效值做一致性校验（避免"只改定价类型不带价格"这类半合法变更）
    const effectivePricingType = input.pricingType ?? offering.pricingType;
    const effectivePrice =
      input.priceMinor === undefined
        ? offering.priceMinor === null
          ? null
          : Number(offering.priceMinor)
        : input.priceMinor;
    const pricingError = validatePricing(effectivePricingType, effectivePrice);
    if (pricingError) throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: pricingError });
    if (input.cancelRule && !(CANCEL_RULES as readonly string[]).includes(input.cancelRule)) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: `cancelRule 需为 ${CANCEL_RULES.join('/')}` });
    }
    if (input.pricingType && !(PRICING_TYPES as readonly string[]).includes(input.pricingType)) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: 'pricingType 不合法' });
    }
    if (input.status && !(OFFERING_TRANSITIONS[offering.status] ?? []).includes(input.status)) {
      throw new BadRequestException({
        code: ERROR_CODES.REQUEST_VALIDATION_FAILED,
        message: `不允许的状态流转：${offering.status} → ${input.status}`,
      });
    }
    if (input.availabilities) {
      const availabilityError = validateAvailabilities(input.availabilities);
      if (availabilityError) throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: availabilityError });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const data: Prisma.CareOfferingUpdateInput = {};
      if (input.title !== undefined) data.title = input.title;
      if (input.description !== undefined) data.description = input.description;
      if (input.areaCode !== undefined) data.areaCode = input.areaCode;
      if (input.radiusKm !== undefined) data.radiusKm = input.radiusKm;
      if (input.pricingType !== undefined) data.pricingType = input.pricingType;
      if (input.priceMinor !== undefined) data.priceMinor = input.priceMinor === null ? null : BigInt(input.priceMinor);
      if (input.cancelRule !== undefined) data.cancelRule = input.cancelRule;
      if (input.status !== undefined) data.status = input.status;
      if (input.availabilities !== undefined) {
        // 全量替换可用时段（同刻时段由 UNIQUE(offering_id,start_at) 兜底）
        await tx.careOfferingAvailability.deleteMany({ where: { offeringId } });
        data.availabilities = {
          create: input.availabilities.map((slot) => ({
            startAt: new Date(slot.startAt),
            endAt: new Date(slot.endAt),
            capacity: slot.capacity ?? 1,
          })),
        };
      }
      await tx.careOffering.update({ where: { id: offeringId }, data });
      return tx.careOffering.findUniqueOrThrow({
        where: { id: offeringId },
        include: { provider: true, availabilities: { orderBy: { startAt: 'asc' } } },
      });
    });

    const trust = await this.orders.trustSummaries([userId]);
    return toOfferingDetail(updated, trust.get(userId)!, true);
  }
}
