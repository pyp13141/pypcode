import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ERROR_CODES } from '../../../../common/error-codes';
import { IdempotencyService } from '../../../../common/idempotency/idempotency.service';
import { NotificationsService } from '../../../notifications/notifications.service';
import { BadgeAwardService } from '../../../../common/badges/badge-award.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CareOrdersService } from '../../care-orders.service';
import { ReviewView, toReviewView } from '../../care-view';

export interface CreateReviewInput {
  rating: number;
  tags?: string[];
  content?: string;
}

/**
 * POST /api/v1/care/orders/:id/reviews — 契约：docs/modules/care/order-reviews.md
 * 幂等键；仅 COMPLETED 订单；双向各一次（UNIQUE(target_type,target_id,reviewer_user_id)）；
 * reviewer/reviewee/角色由服务端推导；未决争议期间暂缓公开展示（DISPUTED_HIDDEN）。
 */
@Injectable()
export class OrderReviewsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CareOrdersService) private readonly orders: CareOrdersService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(BadgeAwardService) private readonly badges: BadgeAwardService,
  ) {}

  async create(
    orderId: string,
    userId: string,
    idempotencyKey: string,
    requestHash: string,
    input: CreateReviewInput,
  ): Promise<ReviewView> {
    const { order, role } = await this.orders.getOrderForParticipant(orderId, userId);
    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: 'rating 需为 1-5 整数' });
    }
    const revieweeUserId = role === 'REQUESTER' ? order.providerUserId : order.requesterUserId;

    return this.idempotency.execute<ReviewView>(
      userId,
      idempotencyKey,
      requestHash,
      async () => {
        const review = await this.prisma.$transaction(async (tx) => {
          const current = await tx.careOrder.findUniqueOrThrow({ where: { id: orderId } });
          if (current.status !== 'COMPLETED') {
            throw new ConflictException({ code: ERROR_CODES.REVIEW_NOT_ALLOWED, message: '仅已完成订单可以评价' });
          }
          const existing = await tx.review.findUnique({
            where: {
              targetType_targetId_reviewerUserId: { targetType: 'CARE_ORDER', targetId: orderId, reviewerUserId: userId },
            },
          });
          if (existing) {
            throw new ConflictException({ code: ERROR_CODES.REVIEW_ALREADY_EXISTS, message: '该订单你已评价过（每方一次）' });
          }
          const unresolvedDispute = await tx.dispute.count({
            where: { careOrderId: orderId, status: { in: ['OPEN', 'EVIDENCE', 'PENDING_RULING', 'APPEALING'] } },
          });
          return tx.review.create({
            data: {
              reviewerUserId: userId,
              revieweeUserId,
              targetType: 'CARE_ORDER',
              targetId: orderId,
              role,
              rating: input.rating,
              tags: input.tags ?? [],
              content: input.content ?? null,
              status: unresolvedDispute > 0 ? 'DISPUTED_HIDDEN' : 'VISIBLE',
            },
          });
        });
        const [reviewer, reviewee] = await Promise.all([
          this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
          this.prisma.user.findUniqueOrThrow({ where: { id: revieweeUserId } }),
        ]);
        await this.notifications.push(revieweeUserId, 'REVIEW_RECEIVED', { targetType: 'CARE_ORDER', targetId: orderId });
        await this.badges.award(userId, 'REVIEW_FIRST', { targetType: 'CARE_ORDER', targetId: orderId });
        return { ref: review.id, data: toReviewView(review, reviewer, reviewee) };
      },
      async (ref) => {
        const review = await this.prisma.review.findUnique({
          where: { id: ref },
          include: { reviewer: true, reviewee: true },
        });
        if (!review || review.targetId !== orderId) {
          throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '评价不存在' });
        }
        return toReviewView(review, review.reviewer, review.reviewee);
      },
    );
  }
}
