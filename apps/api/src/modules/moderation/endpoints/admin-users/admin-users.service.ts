import { BadRequestException, Inject, Injectable, NotFoundException, UseGuards } from '@nestjs/common';
import { ERROR_CODES } from '../../../../common/error-codes';
import { Paginated, paginate, parsePagination } from '../../../../common/pagination';
import { PrismaService } from '../../../../prisma/prisma.service';
import { AdminAuditService } from '../../admin-audit.service';

/** GET /admin/users + POST /admin/users/:id/status — 契约：docs/modules/report-admin/admin-users.md */
@Injectable()
export class AdminUsersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AdminAuditService) private readonly audit: AdminAuditService,
  ) {}

  async list(query: { query?: string; status?: string; page?: string; pageSize?: string }) {
    const { page, pageSize, skip, take } = parsePagination(query);
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.query ? { nickname: { contains: query.query } } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: { id: true, nickname: true, status: true, areaCode: true, createdAt: true, deletedAt: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);
    // 风险标签（MVP：被举报次数 + 被屏蔽次数，聚合口径可解释）
    const ids = rows.map((r) => r.id);
    const [reportCounts, blockCounts] = await Promise.all([
      this.prisma.report.groupBy({ by: ['targetId'], where: { targetType: 'USER', targetId: { in: ids } }, _count: { _all: true } }),
      this.prisma.userBlock.groupBy({ by: ['blockedUserId'], where: { blockedUserId: { in: ids } }, _count: { _all: true } }),
    ]);
    const reports = new Map(reportCounts.map((r) => [r.targetId, r._count._all]));
    const blocks = new Map(blockCounts.map((r) => [r.blockedUserId, r._count._all]));
    const items = rows.map((u) => ({
      id: u.id,
      nickname: u.nickname,
      status: u.status,
      areaCode: u.areaCode,
      createdAt: u.createdAt.toISOString(),
      deleted: u.deletedAt !== null,
      reportCountAgainst: reports.get(u.id) ?? 0,
      blockedByCount: blocks.get(u.id) ?? 0,
    }));
    return paginate(items, page, pageSize, total);
  }

  async setStatus(adminUserId: string, targetUserId: string, status: string, reason: string, requestId?: string) {
    if (!['ACTIVE', 'BANNED'].includes(status)) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: 'status 需为 ACTIVE/BANNED' });
    }
    const user = await this.prisma.user.findFirst({ where: { id: targetUserId, deletedAt: null }, select: { id: true, status: true } });
    if (!user) {
      throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '用户不存在' });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: targetUserId }, data: { status } });
      if (status === 'BANNED') {
        // 封禁即撤销全部会话（AuthGuard 也会拒绝 BANNED 用户）
        await tx.userSession.updateMany({ where: { userId: targetUserId, revokedAt: null }, data: { revokedAt: new Date() } });
      }
    });
    await this.audit.record({
      adminUserId,
      action: status === 'BANNED' ? 'USER_BAN' : 'USER_UNBAN',
      resourceType: 'USER',
      resourceId: targetUserId,
      requestId,
      reason,
      detail: { previousStatus: user.status, newStatus: status },
    });
    return { userId: targetUserId, status };
  }
}
