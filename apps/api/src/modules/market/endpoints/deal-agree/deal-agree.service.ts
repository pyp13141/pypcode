import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ERROR_CODES } from '../../../../common/error-codes';
import { PrismaService } from '../../../../prisma/prisma.service';
import { NotificationsService } from '../../../notifications/notifications.service';
import { MarketDealsService } from '../../market-deals.service';
import { DEAL_ACTIVE_STATUSES } from '../../market-state';
import { MarketDealView } from '../../market-view';

export interface AgreeInput {
  handoverAt?: string;
  handoverArea?: string;
  note?: string;
}

/**
 * POST /api/v1/market/deals/:id/agree — 契约：docs/modules/market/deal-agree.md
 * 双方各自确认交接约定；单方确认 → AGREEMENT_PENDING，双方确认 → AGREED。
 * 跨买家互斥：同一物品同时只允许一笔"进行中"交易（D-012，listing 行锁串行化）。
 */
@Injectable()
export class DealAgreeService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MarketDealsService) private readonly deals: MarketDealsService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  async agree(dealId: string, userId: string, input: AgreeInput): Promise<MarketDealView> {
    const { deal, role } = await this.deals.getDealForParticipant(dealId, userId);
    const counterparty = role === 'BUYER' ? deal.sellerUserId : deal.buyerUserId;
    const handoverAt = input.handoverAt ? new Date(input.handoverAt) : null;
    if (handoverAt && Number.isNaN(handoverAt.getTime())) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: 'handoverAt 时间格式不正确' });
    }

    await this.prisma.$transaction(async (tx) => {
      const listing = await this.deals.lockListing(tx, (await tx.marketDeal.findUniqueOrThrow({ where: { id: dealId } })).listingId);
      if (listing.status !== 'PUBLISHED') {
        throw new ConflictException({ code: ERROR_CODES.LISTING_NOT_AVAILABLE, message: '物品已下架或已售出' });
      }
      const current = await tx.marketDeal.findUniqueOrThrow({ where: { id: dealId } });

      if (current.status === 'AGREED' || current.status === 'HANDED_OVER' || current.status === 'COMPLETED') {
        return; // 已达成（或更后阶段）：幂等返回当前视图
      }
      if (current.status !== 'CONTACTED' && current.status !== 'AGREEMENT_PENDING') {
        throw new ConflictException({ code: ERROR_CODES.DEAL_STATE_INVALID, message: `交易状态 ${current.status} 不可确认约定` });
      }
      const myEvent = await tx.marketDealEvent.count({
        where: { marketDealId: dealId, actorUserId: userId, reasonCode: 'DEAL_AGREED' },
      });
      if (myEvent > 0) return; // 本人已确认，等待对方

      const competing = await tx.marketDeal.count({
        where: { listingId: current.listingId, id: { not: dealId }, status: { in: [...DEAL_ACTIVE_STATUSES] } },
      });
      if (competing > 0) {
        throw new ConflictException({
          code: ERROR_CODES.DEAL_ALREADY_IN_PROGRESS,
          message: '该物品已有另一笔交接约定在进行中',
        });
      }

      const previous = (current.agreementJson as Record<string, unknown> | null) ?? {};
      const agreementJson: Prisma.InputJsonValue = {
        ...previous,
        ...(handoverAt ? { handoverAt: handoverAt.toISOString() } : {}),
        ...(input.handoverArea ? { handoverArea: input.handoverArea } : {}),
        ...(input.note ? { note: input.note } : {}),
        [role === 'BUYER' ? 'buyerAgreed' : 'sellerAgreed']: true,
        lastAgreedAt: new Date().toISOString(),
      };
      const otherRole = role === 'BUYER' ? 'SELLER' : 'BUYER';
      const otherEvent = await tx.marketDealEvent.count({
        where: { marketDealId: dealId, actorRole: otherRole, reasonCode: 'DEAL_AGREED' },
      });
      const target = otherEvent > 0 ? 'AGREED' : 'AGREEMENT_PENDING';
      await this.deals.applyTransition(tx, current, target, { userId, role }, {
        reasonCode: 'DEAL_AGREED',
        note: input.note,
        agreementJson,
        ...(input.handoverArea ? { handoverArea: input.handoverArea } : {}),
      });
    });
    await this.notifications.push(counterparty, 'DEAL_AGREEMENT_UPDATED', { dealId });

    return this.deals.loadDealView(dealId, userId);
  }
}
