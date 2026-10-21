import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../../../../common/error-codes';
import { PrismaService } from '../../../../prisma/prisma.service';
import { MarketDealsService } from '../../market-deals.service';
import { DEAL_DISPUTABLE_STATUSES, MARKET_DISPUTE_REASON_CODES } from '../../market-state';

export interface MarketDisputeView {
  id: string;
  caseType: string;
  marketDealId: string | null;
  status: string;
  reasonCode: string;
  description: string;
  openedBy: string;
  openedByRole: 'BUYER' | 'SELLER';
  createdAt: string;
}

/**
 * POST /api/v1/market/deals/:id/disputes — 契约：docs/modules/market/deal-disputes.md
 * 创建 disputes 工单（case_type=MARKET，market_deal_id 非空）+ dispute_events(SYSTEM)；交易进入 DISPUTED。
 */
@Injectable()
export class DealDisputesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MarketDealsService) private readonly deals: MarketDealsService,
  ) {}

  async open(dealId: string, userId: string, reasonCode: string, description: string): Promise<MarketDisputeView> {
    if (!(MARKET_DISPUTE_REASON_CODES as readonly string[]).includes(reasonCode)) {
      throw new BadRequestException({
        code: ERROR_CODES.REQUEST_VALIDATION_FAILED,
        message: `reasonCode 需为 ${MARKET_DISPUTE_REASON_CODES.join('/')}`,
      });
    }
    const { role } = await this.deals.getDealForParticipant(dealId, userId);

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.marketDeal.findUniqueOrThrow({ where: { id: dealId } });
      const unresolved = await tx.dispute.count({
        where: { marketDealId: dealId, status: { in: ['OPEN', 'EVIDENCE', 'PENDING_RULING', 'APPEALING'] } },
      });
      if (unresolved > 0) {
        throw new ConflictException({ code: ERROR_CODES.DISPUTE_ALREADY_OPEN, message: '该交易已有未决纠纷工单' });
      }
      if (!(DEAL_DISPUTABLE_STATUSES as readonly string[]).includes(current.status)) {
        throw new ConflictException({
          code: ERROR_CODES.DEAL_STATE_INVALID,
          message: `交易状态 ${current.status} 不可发起纠纷`,
        });
      }
      const dispute = await tx.dispute.create({
        data: {
          caseType: 'MARKET',
          marketDealId: dealId,
          openedBy: userId,
          reasonCode,
          description,
          status: 'OPEN',
        },
      });
      await tx.disputeEvent.create({
        data: {
          disputeId: dispute.id,
          actorUserId: userId,
          actorRole: role,
          eventType: 'SYSTEM',
          note: `交易纠纷工单已创建（reasonCode=${reasonCode}）`,
        },
      });
      await this.deals.applyTransition(tx, current, 'DISPUTED', { userId, role }, {
        reasonCode,
        note: `交易进入争议：${description}`.slice(0, 500),
      });
      return {
        id: dispute.id,
        caseType: dispute.caseType,
        marketDealId: dispute.marketDealId,
        status: dispute.status,
        reasonCode: dispute.reasonCode,
        description: dispute.description,
        openedBy: dispute.openedBy,
        openedByRole: role,
        createdAt: dispute.createdAt.toISOString(),
      };
    });
  }
}
