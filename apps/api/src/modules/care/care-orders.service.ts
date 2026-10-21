import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { ERROR_CODES } from '../../common/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import {
  canTransition,
  OrderStatus,
  PRIVATE_DETAILS_READABLE_STATUSES,
  TERMS_VERSION,
  VISIT_OK_FOR_ORDER_COMPLETION,
} from './care-state';
import type { OrderView, TrustSummary } from './care-view';
import { toOrderView } from './care-view';

type Tx = Prisma.TransactionClient;

/**
 * care 模块级领域服务：跨端点的共享规则（参与方校验、状态变更+事件、订单号、条款快照、信任摘要）。
 * 一接口一目录的端点 service 只做本接口编排，公共规则一律落在这里。
 */
@Injectable()
export class CareOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  /** 业务公开编号：PN + yyMMdd + 6 位随机（非自增；碰撞概率可忽略，冲突时重试见 createOrderNo） */
  async createOrderNo(tx: Tx): Promise<string> {
    for (let i = 0; i < 5; i += 1) {
      const d = new Date();
      const ymd = `${String(d.getUTCFullYear()).slice(2)}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
      const orderNo = `PN${ymd}${randomBytes(5).toString('hex').toUpperCase().slice(0, 8)}`;
      const exists = await tx.careOrder.findUnique({ where: { orderNo }, select: { id: true } });
      if (!exists) return orderNo;
    }
    throw new Error('订单号生成失败（连续冲突）');
  }

  /** 取订单并校验调用者为参与方；非参与方一律 404（不泄露存在性） */
  async getOrderForParticipant(orderId: string, userId: string) {
    const order = await this.prisma.careOrder.findUnique({
      where: { id: orderId },
      include: { requester: true, provider: true },
    });
    if (!order || (order.requesterUserId !== userId && order.providerUserId !== userId)) {
      throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '订单不存在' });
    }
    const role: 'REQUESTER' | 'PROVIDER' = order.requesterUserId === userId ? 'REQUESTER' : 'PROVIDER';
    return { order, role };
  }

  /** 参与方视角的订单完整视图（详情/各命令响应共用）：参与方校验 + visit/凭证 + 私密信息存在标记 */
  async loadOrderView(orderId: string, userId: string): Promise<OrderView> {
    await this.getOrderForParticipant(orderId, userId);
    const full = await this.prisma.careOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        requester: true,
        provider: true,
        privateDetail: { select: { careOrderId: true } },
        visits: {
          orderBy: { seq: 'asc' },
          include: {
            evidence: {
              select: { id: true, evidenceType: true, mediaAssetId: true, note: true, createdAt: true },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });
    return toOrderView(full, userId, {
      hasPrivateDetails: full.privateDetail !== null,
      visits: full.visits,
    });
  }

  /** 写状态历史（追加式；必须在同一事务内调用） */
  async writeEvent(
    tx: Tx,
    params: {
      careOrderId: string;
      fromStatus: string | null;
      toStatus: string;
      actorUserId: string;
      actorRole: 'REQUESTER' | 'PROVIDER' | 'ADMIN';
      reasonCode?: string;
      note?: string;
    },
  ): Promise<void> {
    await tx.careOrderEvent.create({
      data: {
        careOrderId: params.careOrderId,
        fromStatus: params.fromStatus,
        toStatus: params.toStatus,
        actorUserId: params.actorUserId,
        actorRole: params.actorRole,
        reasonCode: params.reasonCode ?? null,
        note: params.note ?? null,
      },
    });
  }

  /**
   * 状态机流转 + 事件（事务内）。非法流转抛 ORDER_STATE_INVALID(409)。
   * 所有订单状态变更必须走这里，禁止各端点直写 status。
   */
  async applyTransition(
    tx: Tx,
    order: { id: string; status: string },
    to: OrderStatus,
    actor: { userId: string; role: 'REQUESTER' | 'PROVIDER' | 'ADMIN' },
    extras?: {
      reasonCode?: string;
      note?: string;
      completedAt?: Date;
      cancelledAt?: Date;
      cancelReasonCode?: string;
    },
  ) {
    if (!canTransition(order.status, to)) {
      throw new ConflictException({
        code: ERROR_CODES.ORDER_STATE_INVALID,
        message: `订单状态 ${order.status} 不允许流转到 ${to}`,
      });
    }
    const updated = await tx.careOrder.update({
      where: { id: order.id },
      data: {
        status: to,
        ...(extras?.completedAt ? { completedAt: extras.completedAt } : {}),
        ...(extras?.cancelledAt ? { cancelledAt: extras.cancelledAt } : {}),
        ...(extras?.cancelReasonCode !== undefined ? { cancelReasonCode: extras.cancelReasonCode } : {}),
      },
    });
    await this.writeEvent(tx, {
      careOrderId: order.id,
      fromStatus: order.status,
      toStatus: to,
      actorUserId: actor.userId,
      actorRole: actor.role,
      reasonCode: extras?.reasonCode,
      note: extras?.note,
    });
    return updated;
  }

  /** 参与方信任摘要：手机号验证 + 完成订单数 + 评价样本量（API §3 列表/详情要求） */
  async trustSummaries(userIds: string[]): Promise<Map<string, TrustSummary>> {
    const unique = [...new Set(userIds)];
    const result = new Map<string, TrustSummary>();
    if (unique.length === 0) return result;

    const [verifiedRows, completedRows, reviewRows] = await Promise.all([
      this.prisma.userPrivateProfile.findMany({
        where: { userId: { in: unique }, phoneVerifiedAt: { not: null } },
        select: { userId: true },
      }),
      this.prisma.careOrder.groupBy({
        by: ['providerUserId'],
        where: { providerUserId: { in: unique }, status: 'COMPLETED' },
        _count: { _all: true },
      }),
      this.prisma.review.groupBy({
        by: ['revieweeUserId'],
        where: { revieweeUserId: { in: unique }, status: { not: 'DELETED' } },
        _count: { _all: true },
      }),
    ]);
    const verified = new Set(verifiedRows.map((r) => r.userId));
    const completed = new Map(completedRows.map((r) => [r.providerUserId, r._count._all]));
    const reviews = new Map(reviewRows.map((r) => [r.revieweeUserId, r._count._all]));

    for (const userId of unique) {
      result.set(userId, {
        phoneVerified: verified.has(userId),
        completedOrderCount: completed.get(userId) ?? 0,
        reviewCount: reviews.get(userId) ?? 0,
      });
    }
    return result;
  }

  /** 多次上门订单提交完成前的校验：全部 visit 处于可接受终态（EXCEPTION/MISSED/CANCELLED 需说明） */
  checkVisitsReadyForCompletion(visits: { seq: number; status: string; notes: string | null }[]): string | null {
    for (const visit of visits) {
      if (visit.status === 'COMPLETED') continue;
      const explained =
        (VISIT_OK_FOR_ORDER_COMPLETION as readonly string[]).includes(visit.status) &&
        (visit.notes ?? '').trim().length > 0;
      if (explained) continue;
      return `第 ${visit.seq} 次上门尚未完成（当前 ${visit.status}）；请先完成或说明异常后再提交整体完成`;
    }
    return null;
  }

  /** 订单条款/宠物照料信息快照（下单时固化，存量订单不受公告变更影响） */
  buildTermsSnapshot(params: {
    serviceType: string;
    title: string;
    description: string;
    startAt: Date;
    endAt: Date;
    frequency: string | null;
    pricingType: string;
    agreedPriceMinor: bigint | null;
    cancelRule: string;
    pets: {
      id: string;
      name: string;
      species: string;
      breed: string | null;
      careNotes: { noteType: string; content: string }[];
    }[];
    source: { requestId?: string; offeringId?: string; applicationId?: string };
  }): Prisma.InputJsonValue {
    return {
      termsVersion: TERMS_VERSION,
      pricingType: params.pricingType,
      priceMinor: params.agreedPriceMinor === null ? null : Number(params.agreedPriceMinor),
      cancelRule: params.cancelRule,
      serviceType: params.serviceType,
      title: params.title,
      description: params.description,
      timeWindow: { startAt: params.startAt.toISOString(), endAt: params.endAt.toISOString() },
      frequency: params.frequency,
      pets: params.pets,
      responsibilities: {
        requester: ['如实提供宠物健康与行为信息', '保持约定时间联系畅通', '服务完成后及时确认或提出异议'],
        provider: ['按约定时间上门服务', '按照料说明执行并留存履约记录', '异常情况第一时间联系需求方'],
      },
      addressAccessPolicy: {
        readableStatuses: [...PRIVATE_DETAILS_READABLE_STATUSES],
        note: '精确地址仅在确认后、经独立接口授权读取，每次读取写审计',
      },
      source: params.source,
    };
  }

  /** 是否存在于未决纠纷（评价暂缓公开展示、完成确认限制等用） */
  async hasUnresolvedDispute(careOrderId: string): Promise<boolean> {
    const count = await this.prisma.dispute.count({
      where: { careOrderId, status: { in: ['OPEN', 'EVIDENCE', 'PENDING_RULING', 'APPEALING'] } },
    });
    return count > 0;
  }
}
