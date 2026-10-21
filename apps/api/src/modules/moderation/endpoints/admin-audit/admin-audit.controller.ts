import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { Paginated, paginate, parsePagination } from '../../../../common/pagination';
import { PrismaService } from '../../../../prisma/prisma.service';
import { AdminGuard } from '../../admin.guard';
import { AdminRoles } from '../../admin-roles.decorator';

/**
 * GET /admin/audit-logs — 契约：docs/modules/report-admin/admin-audit.md
 * 只读；追加式表（admin_audit_logs，触发器拒绝改删）。
 */
@ApiTags('admin')
@Controller('admin/audit-logs')
@UseGuards(AdminGuard)
export class AdminAuditController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  @AdminRoles('super_admin')
  @ApiOperation({ summary: '后台操作审计（只读）' })
  async list(@Query() query: { page?: string; pageSize?: string }) {
    const { page, pageSize, skip, take } = parsePagination(query);
    const [total, rows] = await Promise.all([
      this.prisma.adminAuditLog.count(),
      this.prisma.adminAuditLog.findMany({
        include: { admin: { select: { id: true, nickname: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);
    const items = rows.map((log) => ({
      id: log.id,
      admin: log.admin,
      action: log.action,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      requestId: log.requestId,
      reason: log.reason,
      detail: log.detailJson,
      createdAt: log.createdAt.toISOString(),
    }));
    return paginate(items, page, pageSize, total) as Paginated<(typeof items)[number]>;
  }
}
