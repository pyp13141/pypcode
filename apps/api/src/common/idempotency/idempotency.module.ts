import { Global, Module } from '@nestjs/common';
import { IdempotencyService } from './idempotency.service';

/** 幂等执行器（全局）：供 accept/complete/visits/reviews 等标注幂等键的路由注入 */
@Global()
@Module({
  providers: [IdempotencyService],
  exports: [IdempotencyService],
})
export class IdempotencyModule {}
