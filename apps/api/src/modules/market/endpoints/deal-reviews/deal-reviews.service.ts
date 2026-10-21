import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ERROR_CODES } from '../../../../common/error-codes';
import { IdempotencyService } from '../../../../common/idempotency/idempotency.service';
import { NotificationsService } from '../../../notifications/notifications.service';
import { BadgeAwardService } from '../../../../common/badges/badge-award.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { MarketDealsService } from '../../market-deals.service';
import { toReviewView } from '../../../care/care-view';

export interface CreateDealReviewInput {
  rating: number;
  tags?: string[];
  content?: string;
}

/**
 * POST /api/v1/market/deals/:id/reviews — 契约：docs/modules/market/deal-reviews.md
 * 幂等键；仅 COMPLETED；每方一次（UNIQUE）；角色 BUYER/SELLER 服务端推导；未决争议暂缓公开展示。
 */
@Injectable()
export class DealReviewsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MarketDealsService) private readonly deals: MarketDealsService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(BadgeAwardService) private readonly badges: BadgeAwardService,
  ) {}

  async create(dealId: string, userId: string, key: string, requestHash: string, input: CreateDealReviewInput) {
    const { deal, role } = await this.deals.getDealForParticipant(dealId, userId);
    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: 'rating 需为 1-5 整数' });
    }
    const revieweeUserId = role === 'BUYER' ? deal.sellerUserId : deal.buyerUserId;

    return this.idempotency.execute(
      userId,
      key,
      requestHash,
      async () => {
        const review = await this.prisma.$transaction(async (tx) => {
          const current = await tx.marketDeal.findUniqueOrThrow({ where: { id: dealId } });
          if (current.status !== 'COMPLETED') {
            throw new ConflictException({ code: ERROR_CODES.REVIEW_NOT_ALLOWED, message: '仅已完成交易可以评价' });
          }
          const existing = await tx.review.findUnique({
            where: { targetType_targetId_reviewerUserId: { targetType: 'MARKET_DEAL', targetId: dealId, reviewerUserId: userId } },
          });
          if (existing) {
            throw new ConflictException({ code: ERROR_CODES.REVIEW_ALREADY_EXISTS, message: '该交易你已评价过（每方一次）' });
          }
          const unresolved = await tx.dispute.count({
            where: { marketDealId: dealId, status: { in: ['OPEN', 'EVIDENCE', 'PENDING_RULING', 'APPEALING'] } },
          });
          return tx.review.create({
            data: {
              reviewerUserId: userId,
              revieweeUserId,
              targetType: 'MARKET_DEAL',
              targetId: dealId,
              role,
              rating: input.rating,
              tags: input.tags ?? [],
              content: input.content ?? null,
              status: unresolved > 0 ? 'DISPUTED_HIDDEN' : 'VISIBLE',
            },
          });
        });
        const [reviewer, reviewee] = await Promise.all([
          this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
          this.prisma.user.findUniqueOrThrow({ where: { id: revieweeUserId } }),
        ]);
        await this.notifications.push(revieweeUserId, 'REVIEW_RECEIVED', { targetType: 'MARKET_DEAL', targetId: dealId });
        await this.badges.award(userId, 'REVIEW_FIRST', { targetType: 'MARKET_DEAL', targetId: dealId });
        return { ref: review.id, data: toReviewView(review, reviewer, reviewee) };
      },
      async (ref) => {
        const review = await this.prisma.review.findUnique({ where: { id: ref }, include: { reviewer: true, reviewee: true } });
        if (!review || review.targetId !== dealId) {
          throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '评价不存在' });
        }
        return toReviewView(review, review.reviewer, review.reviewee);
      },
    );
  }
}
