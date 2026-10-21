import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ERROR_CODES } from '../../../../common/error-codes';
import { IdempotencyService } from '../../../../common/idempotency/idempotency.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CareOrdersService } from '../../care-orders.service';
import { toVisitView, VisitView } from '../../care-view';

/**
 * POST /api/v1/care/orders/:id/visits — 契约：docs/modules/care/order-visits.md
 * 幂等键；订单 IN_PROGRESS 下创建 SCHEDULED visit（多频次订单）；seq 自动递增。
 */
@Injectable()
export class OrderVisitsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CareOrdersService) private readonly orders: CareOrdersService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
  ) {}

  async create(
    orderId: string,
    userId: string,
    idempotencyKey: string,
    requestHash: string,
    input: { scheduledAt: string; notes?: string },
  ): Promise<VisitView> {
    await this.orders.getOrderForParticipant(orderId, userId);
    const scheduledAt = new Date(input.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: 'scheduledAt 时间格式不正确' });
    }

    return this.idempotency.execute<VisitView>(
      userId,
      idempotencyKey,
      requestHash,
      async () => {
        const visit = await this.prisma.$transaction(async (tx) => {
          const order = await tx.careOrder.findUniqueOrThrow({ where: { id: orderId } });
          if (order.status !== 'IN_PROGRESS') {
            throw new ConflictException({
              code: ERROR_CODES.ORDER_STATE_INVALID,
              message: `订单状态 ${order.status} 不可新增加上门记录（需 IN_PROGRESS）`,
            });
          }
          const last = await tx.careVisit.findFirst({
            where: { careOrderId: orderId },
            orderBy: { seq: 'desc' },
            select: { seq: true },
          });
          return tx.careVisit.create({
            data: {
              careOrderId: orderId,
              seq: (last?.seq ?? 0) + 1,
              scheduledAt,
              notes: input.notes ?? null,
            },
          });
        });
        return { ref: visit.id, data: toVisitView(visit) };
      },
      async (ref) => {
        const visit = await this.prisma.careVisit.findUnique({ where: { id: ref } });
        if (!visit || visit.careOrderId !== orderId) {
          throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '上门记录不存在' });
        }
        return toVisitView(visit);
      },
    );
  }
}
