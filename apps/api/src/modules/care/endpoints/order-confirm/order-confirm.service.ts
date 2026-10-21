import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../../../../common/error-codes';
import { PrismaService } from '../../../../prisma/prisma.service';
import { NotificationsService } from '../../../notifications/notifications.service';
import { CareOrdersService } from '../../care-orders.service';
import { OrderView } from '../../care-view';

/**
 * POST /api/v1/care/orders/:id/confirm — 契约：docs/modules/care/order-confirm.md
 * 参与方双方各自确认条款；双方都确认 → CONFIRMED（STATE_MACHINES §4）。
 * 同一方重复调用幂等（返回当前视图）；确认前必须有私密地址（D-011，ORDER_PRIVATE_DETAILS_REQUIRED）。
 */
@Injectable()
export class OrderConfirmService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CareOrdersService) private readonly orders: CareOrdersService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  async confirm(orderId: string, userId: string): Promise<OrderView> {
    const { order, role } = await this.orders.getOrderForParticipant(orderId, userId);
    const counterparty = role === 'REQUESTER' ? order.providerUserId : order.requesterUserId;

    await this.prisma.$transaction(async (tx) => {
      const current = await tx.careOrder.findUniqueOrThrow({ where: { id: orderId } });
      const myField = role === 'REQUESTER' ? 'confirmedByRequesterAt' : 'confirmedByProviderAt';

      if (current.status === 'PENDING_CONFIRMATION' && current[myField] !== null) {
        return; // 本人已确认，等待对方：幂等返回
      }
      if (current.status !== 'PENDING_CONFIRMATION') {
        // 已 CONFIRMED 且本人此前确认过 → 幂等；其余状态非法
        if (current.status === 'CONFIRMED' && current[myField] !== null) return;
        throw new ConflictException({
          code: ERROR_CODES.ORDER_STATE_INVALID,
          message: `订单状态 ${current.status} 不可确认条款`,
        });
      }

      // 确认门槛：需求方必须先登记服务地址（不能让服务者在无地址情况下确认）
      const privateDetail = await tx.careOrderPrivateDetail.findUnique({ where: { careOrderId: orderId } });
      if (!privateDetail?.addressEncrypted) {
        throw new ConflictException({
          code: ERROR_CODES.ORDER_PRIVATE_DETAILS_REQUIRED,
          message: '请先提交服务地址（private-details）再确认订单条款',
        });
      }

      await tx.careOrder.update({
        where: { id: orderId },
        data: { [myField]: new Date() },
      });
      const after = await tx.careOrder.findUniqueOrThrow({ where: { id: orderId } });
      if (after.confirmedByRequesterAt && after.confirmedByProviderAt) {
        await this.orders.applyTransition(tx, after, 'CONFIRMED', { userId, role }, { reasonCode: 'TERMS_CONFIRMED_BOTH' });
        await this.notifications.push(counterparty, 'ORDER_CONFIRMED', { orderId });
      } else {
        await this.notifications.push(counterparty, 'ORDER_AWAITING_CONFIRM', { orderId });
      }
    });

    return this.orders.loadOrderView(orderId, userId);
  }
}
