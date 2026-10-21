import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../../../prisma/prisma.service';
import { AdminGuard } from '../../admin.guard';
import { AdminRoles } from '../../admin-roles.decorator';

/**
 * GET /admin/metrics/overview — 契约：docs/modules/report-admin/admin-metrics.md
 * 聚合指标（响应率/完成率/取消率/纠纷率/举报处理时长）；只出数字，不含私人内容。
 */
@ApiTags('admin')
@Controller('admin/metrics')
@UseGuards(AdminGuard)
export class AdminMetricsController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get('overview')
  @AdminRoles('analyst')
  @ApiOperation({ summary: '运营概览（聚合）' })
  async overview() {
    const [
      requestTotal,
      requestMatched,
      orderTotal,
      orderCompleted,
      orderCancelled,
      orderDisputed,
      dealTotal,
      dealCompleted,
      disputeOpen,
      reportTotal,
      reportResolved,
      reportPending,
      postTotal,
      listingTotal,
      userTotal,
    ] = await Promise.all([
      this.prisma.careRequest.count(),
      this.prisma.careRequest.count({ where: { status: 'MATCHED' } }),
      this.prisma.careOrder.count(),
      this.prisma.careOrder.count({ where: { status: 'COMPLETED' } }),
      this.prisma.careOrder.count({ where: { status: 'CANCELLED' } }),
      this.prisma.careOrder.count({ where: { status: 'DISPUTED' } }),
      this.prisma.marketDeal.count(),
      this.prisma.marketDeal.count({ where: { status: 'COMPLETED' } }),
      this.prisma.dispute.count({ where: { status: { in: ['OPEN', 'EVIDENCE', 'PENDING_RULING', 'APPEALING'] } } }),
      this.prisma.report.count(),
      this.prisma.report.count({ where: { status: { in: ['RESOLVED', 'DISMISSED'] } } }),
      this.prisma.report.count({ where: { status: { in: ['NEW', 'PROCESSING'] } } }),
      this.prisma.post.count({ where: { deletedAt: null } }),
      this.prisma.marketListing.count(),
      this.prisma.user.count({ where: { deletedAt: null } }),
    ]);

    // 举报处理时长（已处置单的均值）
    const resolved = await this.prisma.report.findMany({
      where: { resolvedAt: { not: null } },
      select: { createdAt: true, resolvedAt: true },
      take: 500,
      orderBy: { resolvedAt: 'desc' },
    });
    const avgResolveHours =
      resolved.length === 0
        ? null
        : Number(
            (resolved.reduce((sum, r) => sum + (r.resolvedAt!.getTime() - r.createdAt.getTime()), 0) / resolved.length / 3600_000).toFixed(1),
          );

    const ratio = (num: number, den: number) => (den === 0 ? null : Number((num / den).toFixed(3)));
    return {
      users: { total: userTotal },
      care: {
        requestTotal,
        requestMatched,
        responseRate: ratio(requestMatched, requestTotal),
        orderTotal,
        completedRate: ratio(orderCompleted, orderTotal),
        cancelRate: ratio(orderCancelled, orderTotal),
        disputeRate: ratio(orderDisputed, orderTotal),
      },
      market: { dealTotal, completedRate: ratio(dealCompleted, dealTotal) },
      moderation: {
        reportTotal,
        reportPending,
        reportResolved,
        avgResolveHours,
        openDisputes: disputeOpen,
      },
      content: { postTotal, listingTotal },
    };
  }
}
