import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../../../../common/error-codes';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CareOrdersService } from '../../care-orders.service';
import { NotificationsService } from '../../../notifications/notifications.service';
import { startWindowHours } from '../../care-state';
import { OrderView } from '../../care-view';

interface TermsSnapshot {
  timeWindow?: { startAt?: string; endAt?: string };
}

/**
 * POST /api/v1/care/orders/:id/start — 契约：docs/modules/care/order-start.md
 * 仅服务者；CONFIRMED → IN_PROGRESS；时间窗校验 ±CARE_START_WINDOW_HOURS（默认 24h，API §3）。
 */
@Injectable()
export class OrderStartService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CareOrdersService) private readonly orders: CareOrdersService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  async start(orderId: string, userId: string): Promise<OrderView> {
    const { order, role } = await this.orders.getOrderForParticipant(orderId, userId);
    if (role !== 'PROVIDER') {
      throw new ConflictException({ code: ERROR_CODES.ORDER_STATE_INVALID, message: '只有服务者可以开始服务' });
    }

    await this.prisma.$transaction(async (tx) => {
      const current = await tx.careOrder.findUniqueOrThrow({ where: { id: orderId } });
      if (current.status !== 'CONFIRMED') {
        throw new ConflictException({
          code: ERROR_CODES.ORDER_STATE_INVALID,
          message: `订单状态 ${current.status} 不可开始服务（需 CONFIRMED）`,
        });
      }
      const terms = (current.agreedTermsJson as TermsSnapshot | null) ?? {};
      const window = terms.timeWindow ?? {};
      const hours = startWindowHours();
      const now = Date.now();
      const lower = window.startAt ? new Date(window.startAt).getTime() - hours * 3600_000 : null;
      const upper = window.endAt ? new Date(window.endAt).getTime() + hours * 3600_000 : null;
      if ((lower !== null && now < lower) || (upper !== null && now > upper)) {
        throw new ConflictException({
          code: ERROR_CODES.ORDER_START_WINDOW_INVALID,
          message: `不在允许的开始时间窗内（约定时间 ±${hours} 小时）`,
        });
      }
      await this.orders.applyTransition(tx, current, 'IN_PROGRESS', { userId, role }, { reasonCode: 'SERVICE_STARTED' });
    });
    await this.notifications.push(order.requesterUserId, 'ORDER_STARTED', { orderId });

    return this.orders.loadOrderView(orderId, userId);
  }
}
