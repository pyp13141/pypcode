import { Global, Module } from '@nestjs/common';
import { MailerService } from './mailer.service';

/** 邮件发送（全局）：SMTP 未配置时 Mock；配置后真实发送（D-014） */
@Global()
@Module({
  providers: [MailerService],
  exports: [MailerService],
})
export class MailerModule {}
