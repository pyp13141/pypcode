import { Global, Module } from '@nestjs/common';
import { SensitiveAccessService } from './sensitive-access.service';

/** 敏感访问审计（全局）：私密地址/手机号/证据的读写路径统一注入 */
@Global()
@Module({
  providers: [SensitiveAccessService],
  exports: [SensitiveAccessService],
})
export class AuditModule {}
