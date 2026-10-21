import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ERROR_CODES } from '../../../../common/error-codes';
import { Paginated, paginate, parsePagination } from '../../../../common/pagination';
import { PrismaService } from '../../../../prisma/prisma.service';
import { REPORT_OPEN_STATUSES, REPORT_REASONS, REPORT_TARGET_TYPES } from '../../moderation-state';

export interface CreateReportInput {
  targetType: string;
  targetId: string;
  reason: string;
  details?: string;
  images?: string[];
}

export interface ReportView {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  details: string | null;
  status: string;
  resolutionNote?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
}

/**
 * POST /api/v1/reports — 契约：docs/modules/reports/reports.md
 * 创建内容举报工单（NEW）；同一用户对同一目标重复举报（未决中）合并 → 409 REPORT_DUPLICATE（产品 7.4）；
 * 进入后台队列（M4 后台）。
 */
@Injectable()
export class ReportsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(reporterUserId: string, input: CreateReportInput): Promise<ReportView> {
    if (!(REPORT_TARGET_TYPES as readonly string[]).includes(input.targetType)) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: 'targetType 不合法' });
    }
    if (!(REPORT_REASONS as readonly string[]).includes(input.reason)) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: 'reason 不合法' });
    }
    await this.assertTargetExists(input.targetType, input.targetId, reporterUserId);

    const existing = await this.prisma.report.findFirst({
      where: {
        reporterUserId,
        targetType: input.targetType,
        targetId: input.targetId,
        status: { in: [...REPORT_OPEN_STATUSES] },
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({ code: ERROR_CODES.REPORT_DUPLICATE, message: '你已举报过该目标，处理中' });
    }
    const report = await this.prisma.report.create({
      data: {
        reporterUserId,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
        details: input.details ?? null,
        images: input.images ?? [],
      },
    });
    return this.view(report);
  }

  /** 会话/消息举报（POST /conversations/:id/report） */
  async createForConversation(
    reporterUserId: string,
    conversationId: string,
    input: { reason: string; details?: string; messageId?: string },
  ): Promise<ReportView> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: { select: { userId: true } } },
    });
    if (!conversation || !conversation.participants.some((p) => p.userId === reporterUserId)) {
      throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '会话不存在' });
    }
    if (input.messageId) {
      const message = await this.prisma.message.findFirst({ where: { id: input.messageId, conversationId }, select: { id: true } });
      if (!message) {
        throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '消息不存在' });
      }
      return this.create(reporterUserId, {
        targetType: 'MESSAGE',
        targetId: input.messageId,
        reason: input.reason,
        details: input.details,
      });
    }
    return this.create(reporterUserId, {
      targetType: 'CONVERSATION',
      targetId: conversationId,
      reason: input.reason,
      details: input.details,
    });
  }

  async listMine(reporterUserId: string, pageRaw?: string, pageSizeRaw?: string): Promise<Paginated<ReportView>> {
    const { page, pageSize, skip, take } = parsePagination({ page: pageRaw, pageSize: pageSizeRaw });
    const [total, rows] = await Promise.all([
      this.prisma.report.count({ where: { reporterUserId } }),
      this.prisma.report.findMany({ where: { reporterUserId }, orderBy: { createdAt: 'desc' }, skip, take }),
    ]);
    return paginate(rows.map((r) => this.view(r)), page, pageSize, total);
  }

  private view(report: {
    id: string;
    targetType: string;
    targetId: string;
    reason: string;
    details: string | null;
    status: string;
    resolutionNote: string | null;
    createdAt: Date;
    resolvedAt: Date | null;
  }): ReportView {
    return {
      id: report.id,
      targetType: report.targetType,
      targetId: report.targetId,
      reason: report.reason,
      details: report.details,
      status: report.status,
      resolutionNote: report.resolutionNote,
      createdAt: report.createdAt.toISOString(),
      resolvedAt: report.resolvedAt?.toISOString() ?? null,
    };
  }

  /** 目标存在性校验（多态目标由服务端校验，ERD reactions 同规则） */
  async assertTargetExists(targetType: string, targetId: string, reporterUserId: string): Promise<void> {
    const notFound = (): never => {
      throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '举报目标不存在' });
    };
    switch (targetType) {
      case 'USER':
        return (await this.prisma.user.findFirst({ where: { id: targetId, deletedAt: null } })) ? undefined : notFound();
      case 'POST':
        return (await this.prisma.post.findUnique({ where: { id: targetId } })) ? undefined : notFound();
      case 'COMMENT':
        return (await this.prisma.comment.findUnique({ where: { id: targetId } })) ? undefined : notFound();
      case 'LISTING':
        return (await this.prisma.marketListing.findUnique({ where: { id: targetId } })) ? undefined : notFound();
      case 'OFFERING':
        return (await this.prisma.careOffering.findUnique({ where: { id: targetId } })) ? undefined : notFound();
      case 'REQUEST':
        return (await this.prisma.careRequest.findUnique({ where: { id: targetId } })) ? undefined : notFound();
      case 'DEAL':
        return (await this.prisma.marketDeal.findUnique({ where: { id: targetId } })) ? undefined : notFound();
      case 'CONVERSATION': {
        const conversation = await this.prisma.conversation.findUnique({
          where: { id: targetId },
          include: { participants: { select: { userId: true } } },
        });
        if (!conversation || !conversation.participants.some((p) => p.userId === reporterUserId)) return notFound();
        return;
      }
      case 'MESSAGE': {
        const message = await this.prisma.message.findUnique({
          where: { id: targetId },
          include: { conversation: { include: { participants: { select: { userId: true } } } } },
        });
        if (!message || !message.conversation.participants.some((p) => p.userId === reporterUserId)) return notFound();
        return;
      }
      default:
        return notFound();
    }
  }
}
