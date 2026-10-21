import { BadRequestException, Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../../common/decorators/public.decorator';
import { ERROR_CODES } from '../../../../common/error-codes';
import { PrismaService } from '../../../../prisma/prisma.service';
import { TransitGraphService, RoutePlan } from '../../transit-graph.service';

/** GET /api/v1/transit/route?fromStationId=&toStationId= — 契约：docs/modules/transit/route.md */
@ApiTags('transit')
@Controller('transit/route')
export class GetTransitRouteController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TransitGraphService) private readonly graph: TransitGraphService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: '地铁路径规划（本地 Dijkstra，零外部 API）' })
  @ApiOkResponse({ description: '分乘坐段返回线路/站点数/耗时；换乘次数=段数-1' })
  async execute(
    @Query('fromStationId') fromStationId: string,
    @Query('toStationId') toStationId: string,
  ): Promise<RoutePlan> {
    if (!fromStationId || !toStationId) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_INVALID, message: '缺少 fromStationId 或 toStationId' });
    }
    // 两站须同城（图按城市构建）
    const from = await this.prisma.transitStation.findUnique({ where: { id: fromStationId } });
    if (!from) {
      throw new BadRequestException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '起点站不存在' });
    }
    return this.graph.planRoute(from.cityId, fromStationId, toStationId);
  }
}
