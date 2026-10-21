import { Body, Controller, Get, HttpCode, Inject, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { ERROR_CODES } from '../../../../common/error-codes';
import { Paginated, paginate, parsePagination } from '../../../../common/pagination';
import { RequestId } from '../../../../common/decorators/request-id.decorator';
import { PrismaService } from '../../../../prisma/prisma.service';
import { NotificationsService } from '../../../notifications/notifications.service';
import { AdminAuditService } from '../../admin-audit.service';
import { AdminGuard } from '../../admin.guard';
import { AdminRoles } from '../../admin-roles.decorator';
import { CurrentAdmin } from '../../current-admin.decorator';
import { AdminActor } from '../../admin.guard';
import { REPORT_STATUSES } from '../../moderation-state';

class ListReportsParams {
  @IsOptional() @IsIn(REPORT_STATUSES as unknown as string[]) status?: string;
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() pageSize?: string;
}

class ResolveReportDto {
  @IsIn(['RESOLVED', 'DISMISSED']) decision!: string;
  @IsString() @Length(2, 500) note!: string;
}

/**
 * GET /admin/reports + POST assign/resolve — 契约：docs/modules/report-admin/admin-reports.md
 * 每一处置写 moderation 审计（操作人/时间/理由/结果）；处理结果通知举报人。
 */
@ApiTags('admin')
@Controller('admin/reports')
@UseGuards(AdminGuard)
export class AdminReportsController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AdminAuditService) private readonly audit: AdminAuditService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  @Get()
  @AdminRoles('content_moderator', 'support_operator')
  @ApiOperation({ summary: '举报工单列表（?status=）' })
  async list(@Query() query: ListReportsParams) {
    const { page, pageSize, skip, take } = parsePagination(query);
    const where = { ...(query.status ? { status: query.status } : {}) };
    const [total, rows] = await Promise.all([
      this.prisma.report.count({ where }),
      this.prisma.report.findMany({
        where,
        include: { reporter: { select: { id: true, nickname: true } }, assignedAdmin: { select: { id: true, nickname: true } } },
        orderBy: { createdAt: 'asc' },
        skip,
        take,
      }),
    ]);
    const items = rows.map((r) => ({
      id: r.id,
      targetType: r.targetType,
      targetId: r.targetId,
      reason: r.reason,
      details: r.details,
      status: r.status,
      reporter: r.reporter,
      assignedAdmin: r.assignedAdmin,
      resolutionNote: r.resolutionNote,
      createdAt: r.createdAt.toISOString(),
      resolvedAt: r.resolvedAt?.toISOString() ?? null,
    }));
    return paginate(items, page, pageSize, total) as Paginated<(typeof items)[number]>;
  }

  @Post(':id/assign')
  @HttpCode(200)
  @AdminRoles('content_moderator', 'support_operator')
  @ApiOperation({ summary: '认领工单（NEW→PROCESSING）' })
  async assign(@CurrentAdmin() admin: AdminActor, @Param('id') id: string, @RequestId() requestId?: string) {
    const report = await this.prisma.report.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!report) throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '工单不存在' });
    const updated = await this.prisma.report.update({
      where: { id },
      data: { status: 'PROCESSING', assignedAdminId: admin.userId },
      select: { id: true, status: true, assignedAdminId: true },
    });
    await this.audit.record({ adminUserId: admin.userId, action: 'REPORT_ASSIGN', resourceType: 'REPORT', resourceId: id, requestId });
    return updated;
  }

  @Post(':id/resolve')
  @HttpCode(200)
  @AdminRoles('content_moderator', 'support_operator')
  @ApiOperation({ summary: '处置工单（RESOLVED/DISMISSED；写理由并通知举报人）' })
  async resolve(@CurrentAdmin() admin: AdminActor, @Param('id') id: string, @Body() dto: ResolveReportDto, @RequestId() requestId?: string) {
    const report = await this.prisma.report.findUnique({ where: { id }, select: { id: true, reporterUserId: true, status: true } });
    if (!report) throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '工单不存在' });
    const updated = await this.prisma.report.update({
      where: { id },
      data: { status: dto.decision, resolutionNote: dto.note, resolvedAt: new Date(), assignedAdminId: admin.userId },
      select: { id: true, status: true, resolutionNote: true, resolvedAt: true },
    });
    await this.notifications.push(report.reporterUserId, 'REPORT_RESOLVED', { reportId: id, status: dto.decision, note: dto.note });
    await this.audit.record({
      adminUserId: admin.userId,
      action: `REPORT_${dto.decision}`,
      resourceType: 'REPORT',
      resourceId: id,
      requestId,
      reason: dto.note,
    });
    return updated;
  }
}
