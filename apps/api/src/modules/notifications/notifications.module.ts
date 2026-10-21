import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './endpoints/notifications/notifications.controller';
import { NotificationReadController } from './endpoints/notification-read/notification-read.controller';

/**
 * 通知模块（M4）：站内信推送 + 列表 + 已读。业务模块 import 本模块使用 NotificationsService。
 * 契约 docs/modules/notifications.md。
 */
@Module({
  controllers: [NotificationsController, NotificationReadController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
