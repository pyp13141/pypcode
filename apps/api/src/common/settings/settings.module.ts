import { Global, Module } from '@nestjs/common';
import { SettingsService } from './settings.service';

/** 运营配置（全局）：admin 配置读写 + 业务侧读取 */
@Global()
@Module({
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
