import { Module } from '@nestjs/common';
import { AuthSharedService } from './auth-shared.service';
import { PostWechatLoginController } from './endpoints/wechat-login/post-wechat-login.controller';
import { PostSmsCodeController } from './endpoints/sms-code/post-sms-code.controller';
import { PostEmailCodeController } from './endpoints/email-code/post-email-code.controller';
import { PostEmailLoginController } from './endpoints/email-login/post-email-login.controller';
import { PostH5LoginController } from './endpoints/h5-login/post-h5-login.controller';
import { PostRefreshController } from './endpoints/refresh/post-refresh.controller';
import { PostLogoutController } from './endpoints/logout/post-logout.controller';

/** 身份模块：登录、会话、验证码。契约见 docs/modules/identity.md */
@Module({
  controllers: [
    PostWechatLoginController,
    PostSmsCodeController,
    PostH5LoginController,
    PostRefreshController,
    PostLogoutController,
    PostEmailCodeController,
    PostEmailLoginController,
  ],
  providers: [AuthSharedService],
  exports: [AuthSharedService],
})
export class IdentityModule {}
