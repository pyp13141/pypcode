import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../../common/decorators/public.decorator';
import { PrismaService } from '../../../../prisma/prisma.service';

/** GET /api/v1/transit/stations?cityId=&q= — 契约：docs/modules/transit/stations.md */
@ApiTags('transit')
@Controller('transit/stations')
export class GetTransitStationsController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: '站点模糊搜索（前缀/包含），返回每站经过线路' })
  @ApiOkResponse({ description: '上限 20 条' })
  async execute(
    @Query('cityId') cityId: string,
    @Query('q') q?: string,
  ) {
    const stations = await this.prisma.transitStation.findMany({
      where: {
        cityId,
        ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
      },
      include: {
        lineStations: { include: { line: { select: { id: true, ref: true, name: true } } } },
      },
      orderBy: { name: 'asc' },
      take: 20,
    });
    return stations.map((s) => ({
      id: s.id,
      name: s.name,
      lines: s.lineStations.map((ls) => ls.line),
    }));
  }
}
