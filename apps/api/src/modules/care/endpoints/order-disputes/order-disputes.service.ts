import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../../../../common/error-codes';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CareOrdersService } from '../../care-orders.service';
import { NotificationsService } from '../../../notifications/notifications.service';
import { DISPUTE_OPENABLE_STATUSES, DISPUTE_REASON_CODES } from '../../care-state';

export interface DisputeView {
  id: string;
  caseType: string;
  careOrderId: string | null;
  status: string;
  reasonCode: string;
  description: string;
  openedBy: string;
  openedByRole: 'REQUESTER' | 'PROVIDER';
  createdAt: string;
}

/**
 * POST /api/v1/care/orders/:id/disputes — 契约：docs/modules/care/order-disputes.md
 * 参与方发起纠纷 → 创建 disputes 工单（case_type=CARE，恰一目标非空）+ dispute_events(SYSTEM)，
 * 订单进入 DISPUTED（不靠改状态代替流程；后续裁定/申诉由 M4 后台实现）。
 */
@Injectable()
export class OrderDisputesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CareOrdersService) private readonly orders: CareOrdersService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  async open(orderId: string, userId: string, reasonCode: string, description: string): Promise<DisputeView> {
    if (!(DISPUTE_REASON_CODES as readonly string[]).includes(reasonCode)) {
      throw new BadRequestException({
        code: ERROR_CODES.REQUEST_VALIDATION_FAILED,
        message: `reasonCode 需为 ${DISPUTE_REASON_CODES.join('/')}`,
      });
    }
    const { order: participantOrder, role } = await this.orders.getOrderForParticipant(orderId, userId);

    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.careOrder.findUniqueOrThrow({ where: { id: orderId } });
      // 先判重复（已有未决工单时无论订单状态都给 DISPUTE_ALREADY_OPEN，语义更精确）
      const unresolved = await tx.dispute.count({
        where: { careOrderId: orderId, status: { in: ['OPEN', 'EVIDENCE', 'PENDING_RULING', 'APPEALING'] } },
      });
      if (unresolved > 0) {
        throw new ConflictException({ code: ERROR_CODES.DISPUTE_ALREADY_OPEN, message: '该订单已有未决纠纷工单' });
      }
      if (!(DISPUTE_OPENABLE_STATUSES as readonly string[]).includes(order.status)) {
        throw new ConflictException({
          code: ERROR_CODES.ORDER_STATE_INVALID,
          message: `订单状态 ${order.status} 不可发起纠纷`,
        });
      }

      const dispute = await tx.dispute.create({
        data: {
          caseType: 'CARE',
          careOrderId: orderId,
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
          note: `纠纷工单已创建（reasonCode=${reasonCode}）`,
        },
      });
      await this.orders.applyTransition(
        tx,
        order,
        'DISPUTED',
        { userId, role },
        { reasonCode, note: `订单进入争议：${description}`.slice(0, 500) },
      );
      return {
        id: dispute.id,
        caseType: dispute.caseType,
        careOrderId: dispute.careOrderId,
        status: dispute.status,
        reasonCode: dispute.reasonCode,
        description: dispute.description,
        openedBy: dispute.openedBy,
        openedByRole: role,
        createdAt: dispute.createdAt.toISOString(),
      };
    });
    const counterparty = role === 'REQUESTER' ? participantOrder.providerUserId : participantOrder.requesterUserId;
    await this.notifications.push(counterparty, 'DISPUTE_OPENED', { orderId, disputeId: result.id });
    return result;
  }
}
