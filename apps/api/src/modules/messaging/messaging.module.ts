import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ModerationModule } from '../moderation/moderation.module';
import { ConversationMessagesController } from './endpoints/conversation-messages/conversation-messages.controller';
import { ConversationMessagesService } from './endpoints/conversation-messages/conversation-messages.service';
import { ConversationReportController } from './endpoints/conversation-report/conversation-report.controller';

/**
 * 会话消息模块（M4）：交易/订单会话的消息收发与举报。
 * 契约总览 docs/modules/messaging.md。会话在业务动作时创建（如 POST /market/deals）。
 */
@Module({
  imports: [NotificationsModule, ModerationModule],
  controllers: [ConversationMessagesController, ConversationReportController],
  providers: [ConversationMessagesService],
})
export class MessagingModule {}
