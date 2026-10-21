import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ERROR_CODES } from '../../../../common/error-codes';
import { Paginated, paginate, parsePagination } from '../../../../common/pagination';
import { PrismaService } from '../../../../prisma/prisma.service';
import { NotificationsService } from '../../../notifications/notifications.service';
import { AdminAuditService } from '../../admin-audit.service';
import { DISPUTE_RESOLUTION_CODES } from '../../moderation-state';

const OPEN_DISPUTE_STATUSES = ['OPEN', 'EVIDENCE', 'PENDING_RULING', 'APPEALING'];

/**
 * 纠纷处理（API §6）：GET 列表 / 证据补充 / 裁定 / 申诉。
 * 硬规则（STATE_MACHINES 实现约束）：裁定必须记录操作者/时间/理由；不能伪造完成；
 * 订单/交易的最终状态由裁定结论驱动（COMPLETED/CANCELLED），NO_FAULT 则退回 PENDING_RULING 继续举证。
 */
@Injectable()
export class AdminDisputesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AdminAuditService) private readonly audit: AdminAuditService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  async list(query: { status?: string; caseType?: string; page?: string; pageSize?: string }) {
    const { page, pageSize, skip, take } = parsePagination(query);
    const where = { ...(query.status ? { status: query.status } : {}), ...(query.caseType ? { caseType: query.caseType } : {}) };
    const [total, rows] = await Promise.all([
      this.prisma.dispute.count({ where }),
      this.prisma.dispute.findMany({
        where,
        include: {
          openedByUser: { select: { id: true, nickname: true } },
          careOrder: { select: { id: true, orderNo: true, status: true, requesterUserId: true, providerUserId: true } },
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take,
      }),
    ]);
    const marketDealIds = rows.filter((r) => r.marketDealId).map((r) => r.marketDealId!) ;
    const deals = marketDealIds.length
      ? await this.prisma.marketDeal.findMany({
          where: { id: { in: marketDealIds } },
          select: { id: true, status: true, buyerUserId: true, sellerUserId: true, listing: { select: { title: true } } },
        })
      : [];
    const dealMap = new Map(deals.map((d) => [d.id, d]));
    const items = rows.map((r) => ({
      id: r.id,
      caseType: r.caseType,
      status: r.status,
      reasonCode: r.reasonCode,
      description: r.description,
      openedBy: r.openedByUser,
      resolutionCode: r.resolutionCode,
      resolvedAt: r.resolvedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      careOrder: r.careOrder
        ? { id: r.careOrder.id, orderNo: r.careOrder.orderNo, status: r.careOrder.status }
        : null,
      marketDeal: r.marketDealId
        ? {
            id: r.marketDealId,
            status: dealMap.get(r.marketDealId)?.status ?? null,
            listingTitle: dealMap.get(r.marketDealId)?.listing.title ?? null,
          }
        : null,
    }));
    return paginate(items, page, pageSize, total) as Paginated<(typeof items)[number]>;
  }

  async addEvidence(adminUserId: string, disputeId: string, note: string, requestId?: string) {
    const dispute = await this.prisma.dispute.findUnique({ where: { id: disputeId }, select: { id: true, status: true } });
    if (!dispute) throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '纠纷不存在' });
    if (!OPEN_DISPUTE_STATUSES.includes(dispute.status)) {
      throw new ConflictException({ code: ERROR_CODES.RESOURCE_CONFLICT, message: `纠纷状态为 ${dispute.status}，不可补充证据` });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.disputeEvent.create({
        data: { disputeId, actorUserId: adminUserId, actorRole: 'ADMIN', eventType: 'EVIDENCE_ADD', note },
      });
      await tx.dispute.update({ where: { id: disputeId }, data: { status: 'EVIDENCE' } });
    });
    await this.audit.record({ adminUserId, action: 'DISPUTE_EVIDENCE', resourceType: 'DISPUTE', resourceId: disputeId, requestId, reason: note });
    return { id: disputeId, status: 'EVIDENCE' };
  }

  async ruling(
    adminUserId: string,
    disputeId: string,
    resolutionCode: string,
    reason: string,
    requestId?: string,
  ) {
    if (!(DISPUTE_RESOLUTION_CODES as readonly string[]).includes(resolutionCode)) {
      throw new BadRequestException({
        code: ERROR_CODES.REQUEST_VALIDATION_FAILED,
        message: `resolutionCode 需为 ${DISPUTE_RESOLUTION_CODES.join('/')}`,
      });
    }
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        careOrder: { select: { id: true, status: true, requesterUserId: true, providerUserId: true } },
      },
    });
    if (!dispute) throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '纠纷不存在' });
    const marketDeal = dispute.marketDealId
      ? await this.prisma.marketDeal.findUnique({
          where: { id: dispute.marketDealId },
          select: { id: true, status: true, buyerUserId: true, sellerUserId: true },
        })
      : null;
    if (!OPEN_DISPUTE_STATUSES.includes(dispute.status)) {
      throw new ConflictException({ code: ERROR_CODES.RESOURCE_CONFLICT, message: `纠纷状态为 ${dispute.status}，不可裁定` });
    }

    await this.prisma.$transaction(async (tx) => {
      if (resolutionCode === 'NO_FAULT') {
        await tx.disputeEvent.create({
          data: { disputeId, actorUserId: adminUserId, actorRole: 'ADMIN', eventType: 'RULING', note: `无法判定，继续举证：${reason}` },
        });
        await tx.dispute.update({ where: { id: disputeId }, data: { status: 'PENDING_RULING' } });
        return;
      }
      // 结论驱动底层业务终态（管理员介入路径：状态从 DISPUTED 直接进入终态，仍写业务事件表）
      const now = new Date();
      if (dispute.careOrderId && dispute.careOrder) {
        const order = dispute.careOrder;
        if (order.status !== 'DISPUTED') {
          throw new ConflictException({ code: ERROR_CODES.ORDER_STATE_INVALID, message: `订单状态为 ${order.status}，不可裁定` });
        }
        const toStatus = resolutionCode === 'COMPLETED' ? 'COMPLETED' : 'CANCELLED';
        await tx.careOrder.update({
          where: { id: order.id },
          data: {
            status: toStatus,
            ...(toStatus === 'COMPLETED' ? { completedAt: now } : { cancelledAt: now, cancelReasonCode: 'ADMIN_RULING' }),
          },
        });
        await tx.careOrderEvent.create({
          data: {
            careOrderId: order.id,
            fromStatus: 'DISPUTED',
            toStatus,
            actorUserId: adminUserId,
            actorRole: 'ADMIN',
            reasonCode: `ADMIN_RULING_${resolutionCode}`,
            note: reason,
          },
        });
      } else if (dispute.marketDealId && marketDeal) {
        const deal = marketDeal;
        if (deal.status !== 'DISPUTED') {
          throw new ConflictException({ code: ERROR_CODES.DEAL_STATE_INVALID, message: `交易状态为 ${deal.status}，不可裁定` });
        }
        const toStatus = resolutionCode === 'COMPLETED' ? 'COMPLETED' : 'CANCELLED';
        await tx.marketDeal.update({
          where: { id: deal.id },
          data: {
            status: toStatus,
            ...(toStatus === 'COMPLETED' ? { completedAt: now } : { cancelledAt: now, cancelReasonCode: 'ADMIN_RULING' }),
          },
        });
        await tx.marketDealEvent.create({
          data: {
            marketDealId: deal.id,
            fromStatus: 'DISPUTED',
            toStatus,
            actorUserId: adminUserId,
            actorRole: 'ADMIN',
            reasonCode: `ADMIN_RULING_${resolutionCode}`,
            note: reason,
          },
        });
      } else {
        throw new ConflictException({ code: ERROR_CODES.RESOURCE_CONFLICT, message: '纠纷缺少业务对象' });
      }

      await tx.disputeEvent.create({
        data: { disputeId, actorUserId: adminUserId, actorRole: 'ADMIN', eventType: 'RULING', note: `裁定 ${resolutionCode}：${reason}` },
      });
      await tx.dispute.update({
        where: { id: disputeId },
        data: { status: 'RULED', resolutionCode, resolvedBy: adminUserId, resolvedAt: now },
      });
    });

    const participants = dispute.careOrder
      ? [dispute.careOrder.requesterUserId, dispute.careOrder.providerUserId]
      : marketDeal
        ? [marketDeal.buyerUserId, marketDeal.sellerUserId]
        : [];
    await this.notifications.pushMany(participants, 'DISPUTE_RULED', { disputeId, resolutionCode, reason });
    await this.audit.record({
      adminUserId,
      action: 'DISPUTE_RULING',
      resourceType: 'DISPUTE',
      resourceId: disputeId,
      requestId,
      reason,
      detail: { resolutionCode },
    });
    return { id: disputeId, status: 'RULED', resolutionCode };
  }

  async appeal(adminUserId: string, disputeId: string, reason: string, requestId?: string) {
    const dispute = await this.prisma.dispute.findUnique({ where: { id: disputeId }, select: { id: true, status: true } });
    if (!dispute) throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '纠纷不存在' });
    if (dispute.status !== 'RULED') {
      throw new ConflictException({ code: ERROR_CODES.RESOURCE_CONFLICT, message: `纠纷状态为 ${dispute.status}，仅已裁定可申诉` });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.disputeEvent.create({
        data: { disputeId, actorUserId: adminUserId, actorRole: 'ADMIN', eventType: 'APPEAL', note: reason },
      });
      await tx.dispute.update({ where: { id: disputeId }, data: { status: 'APPEALING' } });
    });
    await this.audit.record({ adminUserId, action: 'DISPUTE_APPEAL', resourceType: 'DISPUTE', resourceId: disputeId, requestId, reason });
    return { id: disputeId, status: 'APPEALING' };
  }
}
