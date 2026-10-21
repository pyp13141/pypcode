import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../../../../common/error-codes';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CareOrdersService } from '../../care-orders.service';
import { CANCEL_REASON_CODES } from '../../care-state';
import { OrderView } from '../../care-view';

interface TermsSnapshot {
  cancelRule?: string;
  timeWindow?: { startAt?: string; endAt?: string };
}

/**
 * POST /api/v1/care/orders/:id/cancel — 契约：docs/modules/care/order-cancel.md
 * 规则（STATE_MACHINES §4 + DECISIONS D-011 #4）：
 * - PENDING_CONFIRMATION：任一方取消即 CANCELLED（记录取消方=事件 actor、原因码）；
 * - CONFIRMED 且 cancelRule=FREE 且未到约定开始时间：立即 CANCELLED；
 * - CONFIRMED（MUTUAL）/ IN_PROGRESS / COMPLETION_SUBMITTED：首次取消 → CANCEL_REQUESTED，
 *   对方（另一参与方）再次取消 → CANCELLED（视为同意）；
 * - 同一方重复取消（已 CANCEL_REQUESTED）：409 ORDER_CANCEL_NOT_ALLOWED；
 * - COMPLETED / CANCELLED / DISPUTED：409 ORDER_CANCEL_NOT_ALLOWED。
 */
@Injectable()
export class OrderCancelService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CareOrdersService) private readonly orders: CareOrdersService,
  ) {}

  async cancel(orderId: string, userId: string, reasonCode: string, note?: string): Promise<OrderView> {
    if (!(CANCEL_REASON_CODES as readonly string[]).includes(reasonCode)) {
      throw new BadRequestException({
        code: ERROR_CODES.REQUEST_VALIDATION_FAILED,
        message: `reasonCode 需为 ${CANCEL_REASON_CODES.join('/')}`,
      });
    }
    const { role } = await this.orders.getOrderForParticipant(orderId, userId);

    await this.prisma.$transaction(async (tx) => {
      const current = await tx.careOrder.findUniqueOrThrow({ where: { id: orderId } });
      const now = new Date();

      switch (current.status) {
        case 'PENDING_CONFIRMATION': {
          await this.orders.applyTransition(
            tx,
            current,
            'CANCELLED',
            { userId, role },
            { reasonCode, note, cancelledAt: now, cancelReasonCode: reasonCode },
          );
          return;
        }
        case 'CONFIRMED': {
          const terms = (current.agreedTermsJson as TermsSnapshot | null) ?? {};
          const startAt = terms.timeWindow?.startAt;
          const beforeStart = startAt ? Date.now() < new Date(startAt).getTime() : false;
          if (terms.cancelRule === 'FREE' && beforeStart) {
            await this.orders.applyTransition(
              tx,
              current,
              'CANCELLED',
              { userId, role },
              { reasonCode, note, cancelledAt: now, cancelReasonCode: reasonCode },
            );
            return;
          }
          await this.orders.applyTransition(
            tx,
            current,
            'CANCEL_REQUESTED',
            { userId, role },
            { reasonCode, note, cancelReasonCode: reasonCode },
          );
          return;
        }
        case 'IN_PROGRESS':
        case 'COMPLETION_SUBMITTED': {
          // 服务已开始：一律需对方同意
          await this.orders.applyTransition(
            tx,
            current,
            'CANCEL_REQUESTED',
            { userId, role },
            { reasonCode, note, cancelReasonCode: reasonCode },
          );
          return;
        }
        case 'CANCEL_REQUESTED': {
          // 取消方已提交申请；另一参与方再次取消 = 同意 → CANCELLED
          const requester = await tx.careOrderEvent.findFirst({
            where: { careOrderId: orderId, toStatus: 'CANCEL_REQUESTED' },
            orderBy: { createdAt: 'desc' },
          });
          if (requester && requester.actorUserId === userId) {
            throw new ConflictException({
              code: ERROR_CODES.ORDER_CANCEL_NOT_ALLOWED,
              message: '取消申请已提交，等待对方确认',
            });
          }
          await this.orders.applyTransition(
            tx,
            current,
            'CANCELLED',
            { userId, role },
            { reasonCode, note: note ?? '对方同意取消', cancelledAt: now, cancelReasonCode: reasonCode },
          );
          return;
        }
        default: {
          throw new ConflictException({
            code: ERROR_CODES.ORDER_CANCEL_NOT_ALLOWED,
            message: `订单状态 ${current.status} 不可取消`,
          });
        }
      }
    });

    return this.orders.loadOrderView(orderId, userId);
  }
}
