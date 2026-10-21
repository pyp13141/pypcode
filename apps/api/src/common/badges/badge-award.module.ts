import { Global, Module } from '@nestjs/common';
import { BadgeAwardService } from './badge-award.service';

/** 徽章发放（全局）：care/market/community 复用 */
@Global()
@Module({
  providers: [BadgeAwardService],
  exports: [BadgeAwardService],
})
export class BadgeAwardModule {}
