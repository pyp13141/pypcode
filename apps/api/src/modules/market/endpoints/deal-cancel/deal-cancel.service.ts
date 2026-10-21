import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../../../../common/error-codes';
import { PrismaService } from '../../../../prisma/prisma.service';
import { NotificationsService } from '../../../notifications/notifications.service';
import { MarketDealsService } from '../../market-deals.service';
import { DEAL_CANCEL_REASON_CODES, DEAL_CANCELLABLE_STATUSES } from '../../market-state';
import { MarketDealView } from '../../market-view';

/**
 * POST /api/v1/market/deals/:id/cancel — 契约：docs/modules/market/deal-cancel.md
 * 任一方可取消（CONTACTED/AGREEMENT_PENDING/AGREED）；交接后不可取消（走纠纷）。
 */
@Injectable()
export class DealCancelService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MarketDealsService) private readonly deals: MarketDealsService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  async cancel(dealId: string, userId: string, reasonCode: string, note?: string): Promise<MarketDealView> {
    if (!(DEAL_CANCEL_REASON_CODES as readonly string[]).includes(reasonCode)) {
      throw new BadRequestException({
        code: ERROR_CODES.REQUEST_VALIDATION_FAILED,
        message: `reasonCode 需为 ${DEAL_CANCEL_REASON_CODES.join('/')}`,
      });
    }
    const { deal, role } = await this.deals.getDealForParticipant(dealId, userId);

    await this.prisma.$transaction(async (tx) => {
      const current = await tx.marketDeal.findUniqueOrThrow({ where: { id: dealId } });
      if (!(DEAL_CANCELLABLE_STATUSES as readonly string[]).includes(current.status)) {
        throw new ConflictException({
          code: ERROR_CODES.DEAL_STATE_INVALID,
          message: `交易状态 ${current.status} 不可取消（已交接请通过纠纷流程处理）`,
        });
      }
      await this.deals.applyTransition(tx, current, 'CANCELLED', { userId, role }, {
        reasonCode,
        note,
        cancelledAt: new Date(),
        cancelReasonCode: reasonCode,
      });
    });
    const counterparty = role === 'BUYER' ? deal.sellerUserId : deal.buyerUserId;
    await this.notifications.push(counterparty, 'DEAL_STATUS_CHANGED', { dealId });

    return this.deals.loadDealView(dealId, userId);
  }
}
