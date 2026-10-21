import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ERROR_CODES } from '../../common/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { DEAL_ACTIVE_STATUSES, canDealTransition, DealStatus } from './market-state';
import { MarketDealView, toDealView } from './market-view';

type Tx = Prisma.TransactionClient;

/**
 * market 模块级领域服务：参与方校验、交易状态流转+事件（追加式）、
 * **一物一单的原子关闭**（同意交接后跨买家互斥；交接时行锁 listing → SOLD + 竞品交易终结）。
 */
@Injectable()
export class MarketDealsService {
  constructor(private readonly prisma: PrismaService) {}

  /** 取交易并校验调用者为交易双方之一；非参与方一律 404 */
  async getDealForParticipant(dealId: string, userId: string) {
    const deal = await this.prisma.marketDeal.findUnique({
      where: { id: dealId },
      include: {
        buyer: true,
        seller: true,
        listing: { include: { media: true } },
        conversation: { select: { id: true } },
      },
    });
    if (!deal || (deal.buyerUserId !== userId && deal.sellerUserId !== userId)) {
      throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '交易不存在' });
    }
    const role: 'BUYER' | 'SELLER' = deal.buyerUserId === userId ? 'BUYER' : 'SELLER';
    return { deal, role };
  }

  async loadDealView(dealId: string, userId: string): Promise<MarketDealView> {
    const { deal } = await this.getDealForParticipant(dealId, userId);
    return toDealView(deal, userId);
  }

  /** 写交易事件（追加式；必须同事务） */
  async writeEvent(
    tx: Tx,
    params: {
      marketDealId: string;
      fromStatus: string | null;
      toStatus: string;
      actorUserId: string;
      actorRole: 'BUYER' | 'SELLER' | 'ADMIN' | 'SYSTEM';
      reasonCode?: string;
      note?: string;
    },
  ): Promise<void> {
    await tx.marketDealEvent.create({
      data: {
        marketDealId: params.marketDealId,
        fromStatus: params.fromStatus,
        toStatus: params.toStatus,
        actorUserId: params.actorUserId,
        actorRole: params.actorRole,
        reasonCode: params.reasonCode ?? null,
        note: params.note ?? null,
      },
    });
  }

  /** 状态机流转 + 事件（非法流转 409 DEAL_STATE_INVALID） */
  async applyTransition(
    tx: Tx,
    deal: { id: string; status: string },
    to: DealStatus,
    actor: { userId: string; role: 'BUYER' | 'SELLER' | 'ADMIN' | 'SYSTEM' },
    extras?: {
      reasonCode?: string;
      note?: string;
      handoverAt?: Date;
      handoverArea?: string;
      agreementJson?: Prisma.InputJsonValue;
      completedAt?: Date;
      cancelledAt?: Date;
      cancelReasonCode?: string;
    },
  ) {
    if (!canDealTransition(deal.status, to)) {
      throw new ConflictException({
        code: ERROR_CODES.DEAL_STATE_INVALID,
        message: `交易状态 ${deal.status} 不允许流转到 ${to}`,
      });
    }
    const updated = await tx.marketDeal.update({
      where: { id: deal.id },
      data: {
        status: to,
        ...(extras?.handoverAt ? { handoverAt: extras.handoverAt } : {}),
        ...(extras?.handoverArea !== undefined ? { handoverArea: extras.handoverArea } : {}),
        ...(extras?.agreementJson !== undefined ? { agreementJson: extras.agreementJson } : {}),
        ...(extras?.completedAt ? { completedAt: extras.completedAt } : {}),
        ...(extras?.cancelledAt ? { cancelledAt: extras.cancelledAt } : {}),
        ...(extras?.cancelReasonCode !== undefined ? { cancelReasonCode: extras.cancelReasonCode } : {}),
      },
    });
    await this.writeEvent(tx, {
      marketDealId: deal.id,
      fromStatus: deal.status,
      toStatus: to,
      actorUserId: actor.userId,
      actorRole: actor.role,
      reasonCode: extras?.reasonCode,
      note: extras?.note,
    });
    return updated;
  }

  /**
   * 行锁列表公告并校验可交易（在事务内调用）。
   * 一物一单的互斥点：同意交接（AGREEMENT_PENDING/AGREED/HANDED_OVER）在同一 listing 上跨买家唯一。
   */
  async lockListing(tx: Tx, listingId: string): Promise<{ id: string; status: string; sellerUserId: string; title: string }> {
    const rows = await tx.$queryRaw<{ id: string; status: string; seller_user_id: string; title: string }[]>`
      SELECT id, status, seller_user_id, title FROM market_listings WHERE id = ${listingId}::uuid FOR UPDATE
    `;
    const listing = rows[0];
    if (!listing) {
      throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '列表不存在' });
    }
    return { id: listing.id, status: listing.status, sellerUserId: listing.seller_user_id, title: listing.title };
  }

  /** 取消该列表上其它"进行中"交易（交接成功时调用；同事务内） */
  async cancelCompetingDeals(tx: Tx, listingId: string, exceptDealId: string, actorUserId: string): Promise<number> {
    // 含 CONTACTED 咨询单：物品售出后任何未终结交易都不可能再推进，一并终结
    const competing = await tx.marketDeal.findMany({
      where: { listingId, id: { not: exceptDealId }, status: { notIn: ['CANCELLED', 'COMPLETED', 'DISPUTED'] } },
      select: { id: true, status: true },
    });
    for (const deal of competing) {
      await tx.marketDeal.update({
        where: { id: deal.id },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReasonCode: 'LISTING_SOLD' },
      });
      await this.writeEvent(tx, {
        marketDealId: deal.id,
        fromStatus: deal.status,
        toStatus: 'CANCELLED',
        actorUserId,
        actorRole: 'SYSTEM',
        reasonCode: 'LISTING_SOLD',
        note: '物品已与另一位买家完成交接，交易自动终结',
      });
    }
    return competing.length;
  }

  /** 某交易某方是否已写过指定 reasonCode 的事件（用于双方确认类流程） */
  async hasEvent(dealId: string, actorUserId: string, reasonCode: string): Promise<boolean> {
    const count = await this.prisma.marketDealEvent.count({
      where: { marketDealId: dealId, actorUserId, reasonCode },
    });
    return count > 0;
  }

  /** 是否存在未决纠纷（评价/完成限制用） */
  async hasUnresolvedDispute(dealId: string): Promise<boolean> {
    const count = await this.prisma.dispute.count({
      where: { marketDealId: dealId, status: { in: ['OPEN', 'EVIDENCE', 'PENDING_RULING', 'APPEALING'] } },
    });
    return count > 0;
  }

  /** 收藏数（reactions：LISTING + FAVORITE） */
  async favoriteCounts(listingIds: string[]): Promise<Map<string, number>> {
    if (listingIds.length === 0) return new Map();
    const rows = await this.prisma.reaction.groupBy({
      by: ['targetId'],
      where: { targetType: 'LISTING', reactionType: 'FAVORITE', targetId: { in: listingIds } },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.targetId, r._count._all]));
  }
}
