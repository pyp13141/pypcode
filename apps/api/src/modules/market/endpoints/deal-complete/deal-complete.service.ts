import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../../../../common/error-codes';
import { PrismaService } from '../../../../prisma/prisma.service';
import { NotificationsService } from '../../../notifications/notifications.service';
import { MarketDealsService } from '../../market-deals.service';
import { MarketDealView } from '../../market-view';

/**
 * POST /api/v1/market/deals/:id/complete — 契约：docs/modules/market/deal-complete.md
 * 双方各自确认已交接：首方确认 → HANDED_OVER（**原子关闭物品**：行锁 listing → SOLD，
 * 终结同物品其它进行中交易）；另一方确认 → COMPLETED（产品 11.5）。
 * 线下交接确认不代表平台验证物品真实情况（响应含提示；前端展示）。
 */
@Injectable()
export class DealCompleteService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MarketDealsService) private readonly deals: MarketDealsService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  async complete(dealId: string, userId: string): Promise<MarketDealView> {
    const { deal, role } = await this.deals.getDealForParticipant(dealId, userId);
    const counterparty = role === 'BUYER' ? deal.sellerUserId : deal.buyerUserId;

    await this.prisma.$transaction(async (tx) => {
      const current = await tx.marketDeal.findUniqueOrThrow({ where: { id: dealId } });
      if (current.status === 'AGREED') {
        const listing = await this.deals.lockListing(tx, current.listingId);
        if (listing.status !== 'PUBLISHED') {
          throw new ConflictException({ code: ERROR_CODES.LISTING_NOT_AVAILABLE, message: '物品已下架或已被他人交接' });
        }
        // 一物一单：原子关闭物品 + 终结其它进行中交易
        await tx.marketListing.update({ where: { id: listing.id }, data: { status: 'SOLD' } });
        await this.deals.cancelCompetingDeals(tx, listing.id, dealId, userId);
        await this.deals.applyTransition(tx, current, 'HANDED_OVER', { userId, role }, {
          reasonCode: 'HANDOVER_CONFIRMED',
          note: `${role === 'BUYER' ? '买方' : '卖方'}确认已交接`,
          handoverAt: new Date(),
        });
        return;
      }
      if (current.status === 'HANDED_OVER') {
        const mine = await this.deals.hasEvent(dealId, userId, 'HANDOVER_CONFIRMED');
        if (mine) {
          throw new ConflictException({ code: ERROR_CODES.RESOURCE_CONFLICT, message: '已确认交接，等待对方确认' });
        }
        await this.deals.applyTransition(tx, current, 'COMPLETED', { userId, role }, {
          reasonCode: 'HANDOVER_CONFIRMED',
          note: `${role === 'BUYER' ? '买方' : '卖方'}确认已交接`,
          completedAt: new Date(),
        });
        return;
      }
      throw new ConflictException({
        code: ERROR_CODES.DEAL_STATE_INVALID,
        message: `交易状态 ${current.status} 不可确认交接（需 AGREED/HANDED_OVER）`,
      });
    });
    await this.notifications.push(counterparty, 'DEAL_STATUS_CHANGED', { dealId });

    return this.deals.loadDealView(dealId, userId);
  }
}
