import { Module } from '@nestjs/common';
import { GetMeController } from './endpoints/me/get-me.controller';
import { PatchMeProfileController } from './endpoints/me-profile/patch-me-profile.controller';
import { PatchMePrivacyController } from './endpoints/me-privacy/patch-me-privacy.controller';
import { MeBlocksController } from './endpoints/me-blocks/me-blocks.controller';

/** 用户模块：资料、隐私、屏蔽。契约见 docs/modules/users.md */
@Module({
  controllers: [GetMeController, PatchMeProfileController, PatchMePrivacyController, MeBlocksController],
})
export class UsersModule {}
