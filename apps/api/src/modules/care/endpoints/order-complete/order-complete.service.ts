import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../../../../common/error-codes';
import { IdempotencyService } from '../../../../common/idempotency/idempotency.service';
import { NotificationsService } from '../../../notifications/notifications.service';
import { BadgeAwardService } from '../../../../common/badges/badge-award.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CareOrdersService } from '../../care-orders.service';
import { OrderView } from '../../care-view';

/**
 * POST /api/v1/care/orders/:id/complete — 契约：docs/modules/care/order-complete.md
 * 双角色端点（D-011 #5）：
 * - 服务者：IN_PROGRESS →（全部 visit 完成或异常已说明）→ COMPLETION_SUBMITTED；
 * - 需求方：COMPLETION_SUBMITTED → COMPLETED（确认完成；有未决纠纷时拒绝）。
 * 幂等键必填。
 */
@Injectable()
export class OrderCompleteService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CareOrdersService) private readonly orders: CareOrdersService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(BadgeAwardService) private readonly badges: BadgeAwardService,
  ) {}

  async complete(orderId: string, userId: string, idempotencyKey: string, requestHash: string): Promise<OrderView> {
    const { order, role } = await this.orders.getOrderForParticipant(orderId, userId);
    const counterparty = role === 'REQUESTER' ? order.providerUserId : order.requesterUserId;

    return this.idempotency.execute<OrderView>(
      userId,
      idempotencyKey,
      requestHash,
      async () => {
        await this.prisma.$transaction(async (tx) => {
          const current = await tx.careOrder.findUniqueOrThrow({ where: { id: orderId } });

          if (role === 'PROVIDER') {
            if (current.status !== 'IN_PROGRESS') {
              throw new ConflictException({
                code: ERROR_CODES.ORDER_STATE_INVALID,
                message: `订单状态 ${current.status} 不可提交完成（需 IN_PROGRESS）`,
              });
            }
            const visits = await tx.careVisit.findMany({
              where: { careOrderId: orderId },
              select: { seq: true, status: true, notes: true },
            });
            const visitError = this.orders.checkVisitsReadyForCompletion(visits);
            if (visitError) {
              throw new ConflictException({ code: ERROR_CODES.ORDER_STATE_INVALID, message: visitError });
            }
            await this.orders.applyTransition(tx, current, 'COMPLETION_SUBMITTED', { userId, role }, { reasonCode: 'COMPLETION_SUBMITTED' });
            return;
          }

          // 需求方确认完成
          if (current.status !== 'COMPLETION_SUBMITTED') {
            throw new ConflictException({
              code: ERROR_CODES.ORDER_STATE_INVALID,
              message: `订单状态 ${current.status} 不可确认完成（需 COMPLETION_SUBMITTED）`,
            });
          }
          if (await this.orders.hasUnresolvedDispute(orderId)) {
            throw new ConflictException({
              code: ERROR_CODES.ORDER_STATE_INVALID,
              message: '订单存在未决纠纷，完成确认暂缓（由纠纷流程处理）',
            });
          }
          await this.orders.applyTransition(
            tx,
            current,
            'COMPLETED',
            { userId, role },
            { reasonCode: 'COMPLETION_CONFIRMED', completedAt: new Date() },
          );
        });
        await this.notifications.push(
          counterparty,
          role === 'PROVIDER' ? 'ORDER_COMPLETION_SUBMITTED' : 'ORDER_COMPLETED',
          { orderId },
        );
        if (role === 'REQUESTER') {
          // 徽章：服务者完成首单/累计 5 单（幂等，D-014 期补齐的发放点）
          const completed = await this.prisma.careOrder.count({ where: { providerUserId: counterparty, status: 'COMPLETED' } });
          await this.badges.awardCareMilestones(counterparty, completed, orderId);
        }
        return { ref: orderId, data: await this.orders.loadOrderView(orderId, userId) };
      },
      async () => this.orders.loadOrderView(orderId, userId),
    );
  }
}
