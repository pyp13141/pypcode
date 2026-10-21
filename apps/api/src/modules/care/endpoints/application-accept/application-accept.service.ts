import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ERROR_CODES } from '../../../../common/error-codes';
import { IdempotencyService } from '../../../../common/idempotency/idempotency.service';
import { NotificationsService } from '../../../notifications/notifications.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CareOrdersService } from '../../care-orders.service';
import { PRIVATE_DETAILS_READABLE_STATUSES } from '../../care-state';

type Tx = Prisma.TransactionClient;

export interface AcceptResult {
  applicationId: string;
  orderId: string;
}

/**
 * POST /api/v1/care/applications/:applicationId/accept ⭐关键事务（API §3 / ERD 不变量 4）
 *
 * 单事务内：行锁需求（SELECT ... FOR UPDATE）→ 校验 application=PENDING 且 request=PUBLISHED
 * → 其余 PENDING 申请置 EXPIRED → application=ACCEPTED → 创建 order(PENDING_CONFIRMATION，条款快照)
 * → 回填 care_order_id → request=MATCHED → 写订单事件。
 * 失败整体回滚，绝不留下"已接受但无订单"。并发接受由需求行锁串行化，只会成一单。
 */
@Injectable()
export class ApplicationAcceptService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CareOrdersService) private readonly orders: CareOrdersService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  async accept(applicationId: string, requesterUserId: string, idempotencyKey: string, requestHash: string): Promise<AcceptResult> {
    const application = await this.prisma.careApplication.findUnique({
      where: { id: applicationId },
      include: { request: true },
    });
    // 非需求方一律 404（不泄露申请存在性；与订单参与方校验一致）
    if (!application || application.request.requesterUserId !== requesterUserId) {
      throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '申请不存在' });
    }

    return this.idempotency.execute<AcceptResult>(
      requesterUserId,
      idempotencyKey,
      requestHash,
      async () => {
        const orderId = await this.prisma.$transaction((tx) => this.acceptInTransaction(tx, application.id, application.requestId, requesterUserId));
        await this.notifications.push(application.applicantUserId, 'ORDER_CREATED', { orderId });
        return { ref: orderId, data: { applicationId, orderId } };
      },
      async (ref) => {
        const order = await this.prisma.careOrder.findUnique({ where: { id: ref }, select: { id: true, applicationId: true } });
        if (!order?.applicationId) {
          throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '订单不存在' });
        }
        return { applicationId: order.applicationId, orderId: order.id };
      },
    );
  }

  private async acceptInTransaction(tx: Tx, applicationId: string, requestId: string, requesterUserId: string): Promise<string> {
    // 1) 行锁需求：并发 accept 在此串行化（ERD 不变量 4 的锁点）
    const lockedRows = await tx.$queryRaw<{ id: string; status: string }[]>`
      SELECT id, status FROM care_requests WHERE id = ${requestId}::uuid FOR UPDATE
    `;
    const locked = lockedRows[0];
    if (!locked) {
      throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '需求不存在' });
    }
    if (locked.status !== 'PUBLISHED') {
      const existingOrder = await tx.careOrder.findFirst({ where: { requestId }, select: { id: true } });
      if (existingOrder) {
        throw new ConflictException({ code: ERROR_CODES.CARE_ORDER_EXISTS, message: '该需求已存在订单' });
      }
      throw new ConflictException({ code: ERROR_CODES.REQUEST_NOT_OPEN, message: '需求已不处于可匹配状态' });
    }

    // 2) 锁内重读申请（拿最新状态；乐观路径已被行锁保护）
    const application = await tx.careApplication.findUnique({ where: { id: applicationId } });
    if (!application || application.requestId !== requestId) {
      throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '申请不存在' });
    }
    if (application.status !== 'PENDING') {
      throw new ConflictException({ code: ERROR_CODES.APPLICATION_STATE_INVALID, message: `申请状态为 ${application.status}，不可接受` });
    }

    const request = await tx.careRequest.findUniqueOrThrow({ where: { id: requestId } });
    const now = new Date();

    // 3) 其余 PENDING 申请终止为 EXPIRED（每个申请只有一个终态）
    await tx.careApplication.updateMany({
      where: { requestId, status: 'PENDING', id: { not: applicationId } },
      data: { status: 'EXPIRED', decidedAt: now },
    });

    // 4) 接受本申请
    await tx.careApplication.update({
      where: { id: applicationId },
      data: { status: 'ACCEPTED', decidedAt: now },
    });

    // 5) 创建订单（条款/宠物照料信息快照；价格 = 申请报价 ?? 需求标价）
    const pets = await tx.pet.findMany({
      where: { id: { in: request.petIds } },
      include: { careNotes: true },
    });
    const agreedPriceMinor = application.proposedPriceMinor ?? request.priceMinor;
    const orderNo = await this.orders.createOrderNo(tx);
    const terms = this.orders.buildTermsSnapshot({
      serviceType: request.serviceType,
      title: request.title,
      description: request.description,
      startAt: request.startAt,
      endAt: request.endAt,
      frequency: request.frequency,
      pricingType: request.pricingType,
      agreedPriceMinor,
      cancelRule: request.cancelRule,
      pets: pets.map((pet) => ({
        id: pet.id,
        name: pet.name,
        species: pet.species,
        breed: pet.breed,
        // 只有标记 ORDER_PARTICIPANTS 的照料注意事项进入订单快照（ERD pet_care_notes）
        careNotes: pet.careNotes
          .filter((note) => note.visibility === 'ORDER_PARTICIPANTS')
          .map((note) => ({ noteType: note.noteType, content: note.content })),
      })),
      source: { requestId, applicationId },
    });
    const order = await tx.careOrder.create({
      data: {
        orderNo,
        requestId,
        applicationId,
        requesterUserId: request.requesterUserId,
        providerUserId: application.applicantUserId,
        status: 'PENDING_CONFIRMATION',
        pricingType: request.pricingType,
        priceMinor: agreedPriceMinor,
        agreedTermsJson: terms,
      },
    });

    // 6) 回填订单引用 + 需求置 MATCHED
    await tx.careApplication.update({ where: { id: applicationId }, data: { careOrderId: order.id } });
    await tx.careRequest.update({
      where: { id: requestId },
      data: { status: 'MATCHED', matchedAt: now },
    });

    // 7) 需求携带的紧急联系人（加密）复制进订单私密表；地址由需求方经 PUT private-details 提交
    if (request.emergencyContactEncrypted) {
      await tx.careOrderPrivateDetail.create({
        data: {
          careOrderId: order.id,
          emergencyContactEncrypted: request.emergencyContactEncrypted,
          accessPolicy: { readableStatuses: [...PRIVATE_DETAILS_READABLE_STATUSES] },
        },
      });
    }

    // 8) 状态历史（追加式）
    await this.orders.writeEvent(tx, {
      careOrderId: order.id,
      fromStatus: null,
      toStatus: 'PENDING_CONFIRMATION',
      actorUserId: requesterUserId,
      actorRole: 'REQUESTER',
      reasonCode: 'APPLICATION_ACCEPTED',
      note: `接受申请创建订单（application=${applicationId}）`,
    });

    return order.id;
  }
}
