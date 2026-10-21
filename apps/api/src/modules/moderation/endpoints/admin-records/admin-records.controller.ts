import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { Paginated, paginate, parsePagination } from '../../../../common/pagination';
import { PrismaService } from '../../../../prisma/prisma.service';
import { AdminGuard } from '../../admin.guard';
import { AdminRoles } from '../../admin-roles.decorator';

/**
 * GET /admin/care-orders + GET /admin/market-deals — 契约：docs/modules/report-admin/admin-records.md
 * 只读必要字段；**地址/门禁/紧急联系人默认不可见**（按工单临时授权+审计的专用路径在 M4 后另评，D-013）。
 */
@ApiTags('admin')
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminRecordsController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get('care-orders')
  @AdminRoles('support_operator', 'analyst')
  @ApiOperation({ summary: '订单列表（只读；不含私密地址/紧急联系人）' })
  async careOrders(@Query() query: { status?: string; page?: string; pageSize?: string }) {
    const { page, pageSize, skip, take } = parsePagination(query);
    const where = { ...(query.status ? { status: query.status } : {}) };
    const [total, rows] = await Promise.all([
      this.prisma.careOrder.count({ where }),
      this.prisma.careOrder.findMany({
        where,
        include: {
          requester: { select: { id: true, nickname: true } },
          provider: { select: { id: true, nickname: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);
    const items = rows.map((o) => ({
      id: o.id,
      orderNo: o.orderNo,
      status: o.status,
      pricingType: o.pricingType,
      priceMinor: o.priceMinor === null ? null : Number(o.priceMinor),
      requester: o.requester,
      provider: o.provider,
      createdAt: o.createdAt.toISOString(),
      completedAt: o.completedAt?.toISOString() ?? null,
    }));
    return paginate(items, page, pageSize, total) as Paginated<(typeof items)[number]>;
  }

  @Get('market-deals')
  @AdminRoles('support_operator', 'analyst')
  @ApiOperation({ summary: '交易列表（只读；无资金字段）' })
  async marketDeals(@Query() query: { status?: string; page?: string; pageSize?: string }) {
    const { page, pageSize, skip, take } = parsePagination(query);
    const where = { ...(query.status ? { status: query.status } : {}) };
    const [total, rows] = await Promise.all([
      this.prisma.marketDeal.count({ where }),
      this.prisma.marketDeal.findMany({
        where,
        include: {
          buyer: { select: { id: true, nickname: true } },
          seller: { select: { id: true, nickname: true } },
          listing: { select: { id: true, title: true, listingType: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);
    const items = rows.map((d) => ({
      id: d.id,
      status: d.status,
      listing: d.listing,
      buyer: d.buyer,
      seller: d.seller,
      handoverArea: d.handoverArea,
      createdAt: d.createdAt.toISOString(),
      completedAt: d.completedAt?.toISOString() ?? null,
    }));
    return paginate(items, page, pageSize, total) as Paginated<(typeof items)[number]>;
  }
}
