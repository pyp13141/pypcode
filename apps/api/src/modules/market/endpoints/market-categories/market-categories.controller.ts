import { Controller, Get, Inject, NotFoundException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../../common/decorators/public.decorator';
import { PrismaService } from '../../../../prisma/prisma.service';
import { ERROR_CODES } from '../../../../common/error-codes';

interface CategoryView {
  code: string;
  name: string;
  riskLevel: string;
}

/**
 * GET /api/v1/market/categories — 契约：docs/modules/market/categories.md
 * 公开分类字典（含风险级别，HIGH 类目发布即人工审核）。
 * 2026-10-11 新增：客户端发布表单此前硬编码 categoryCode='OTHER'，
 * HIGH 风险类目人审规则永不触发（UX-REVIEW P1）。
 */
@ApiTags('market')
@Controller('market/categories')
export class MarketCategoriesController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: '集市分类字典（公开；HIGH 类目发布转人工审核）' })
  @ApiOkResponse({ description: 'CategoryView[]' })
  async list(): Promise<CategoryView[]> {
    const rows = await this.prisma.marketCategory.findMany({ orderBy: { code: 'asc' } });
    if (rows.length === 0) {
      throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '分类未配置' });
    }
    return rows.map((row) => ({ code: row.code, name: row.name, riskLevel: row.riskLevel }));
  }
}
