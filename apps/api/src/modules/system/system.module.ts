import { Module } from '@nestjs/common';
import { GetHealthController } from './endpoints/health/get-health.controller';
import { GetHealthService } from './endpoints/health/get-health.service';
import { GetMetaController } from './endpoints/meta/get-meta.controller';

/**
 * 系统模块：健康检查、服务元信息。
 * 每个接口一个目录（controller + service 分离），新增接口在 endpoints/ 下建目录即可。
 */
@Module({
  controllers: [GetHealthController, GetMetaController],
  providers: [GetHealthService],
})
export class SystemModule {}
