import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../../common/decorators/public.decorator';
import { PrismaService } from '../../../../prisma/prisma.service';

/** GET /api/v1/transit/cities — 契约：docs/modules/transit/cities.md */
@ApiTags('transit')
@Controller('transit/cities')
export class GetTransitCitiesController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: '已导入地铁数据的城市列表' })
  @ApiOkResponse({ description: '每城带线路数与站点数' })
  async execute() {
    const cities = await this.prisma.transitCity.findMany({
      where: { status: 'ACTIVE' },
      include: { _count: { select: { lines: true, stations: true } } },
      orderBy: { name: 'asc' },
    });
    return cities.map((c) => ({
      id: c.id,
      name: c.name,
      lineCount: c._count.lines,
      stationCount: c._count.stations,
    }));
  }
}
