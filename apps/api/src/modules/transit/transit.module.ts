import { Module } from '@nestjs/common';
import { TransitGraphService } from './transit-graph.service';
import { GetTransitCitiesController } from './endpoints/cities/get-cities.controller';
import { GetTransitStationsController } from './endpoints/stations/get-stations.controller';
import { GetTransitRouteController } from './endpoints/route/get-route.controller';
import { MyStationsController } from './endpoints/my-stations/my-stations.controller';

/** 地铁模块（D-009）：静态数据 + 本地图算法，零地图 API。契约见 docs/modules/transit.md */
@Module({
  controllers: [
    GetTransitCitiesController,
    GetTransitStationsController,
    GetTransitRouteController,
    MyStationsController,
  ],
  providers: [TransitGraphService],
  exports: [TransitGraphService],
})
export class TransitModule {}
