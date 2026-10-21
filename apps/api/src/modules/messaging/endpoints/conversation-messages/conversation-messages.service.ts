import { BadRequestException, HttpException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ERROR_CODES } from '../../../../common/error-codes';
import { Paginated, paginate, parsePagination } from '../../../../common/pagination';
import { SettingsService } from '../../../../common/settings/settings.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { NotificationsService } from '../../../notifications/notifications.service';
import { MESSAGE_PER_MINUTE_LIMIT, riskKeywordsHit } from '../../../community/community-state';

export interface MessageView {
  id: string;
  conversationId: string;
  sender: { id: string; nickname: string; avatarUrl: string | null };
  content: string;
  isMine: boolean;
  riskTip: string | null;
  createdAt: string;
}

const RISK_TIP = '消息包含联系方式/转账相关字样：请勿脱离平台向陌生人转账，交接建议在公共场所进行';

/**
 * GET/POST /api/v1/conversations/:id/messages — 契约：docs/modules/messaging/conversation-messages.md
 * 仅会话参与方；限流（默认 10 条/分钟，可由运营配置覆盖）；关键词风险提醒随响应下发。
 */
@Injectable()
export class ConversationMessagesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(SettingsService) private readonly settings: SettingsService,
  ) {}

  async list(conversationId: string, userId: string, pageRaw?: string, pageSizeRaw?: string): Promise<Paginated<MessageView>> {
    await this.assertParticipant(conversationId, userId);
    const { page, pageSize, skip, take } = parsePagination({ page: pageRaw, pageSize: pageSizeRaw });
    const where = { conversationId, status: 'SENT' };
    const [total, rows] = await Promise.all([
      this.prisma.message.count({ where }),
      this.prisma.message.findMany({ where, include: { sender: true }, orderBy: { createdAt: 'asc' }, skip, take }),
    ]);
    const items = rows.map((m) => this.view(m, userId));
    return paginate(items, page, pageSize, total);
  }

  async create(conversationId: string, userId: string, content: string): Promise<MessageView> {
    const participants = await this.assertParticipant(conversationId, userId);
    const rules = await this.settings.get<{ messagePerMinute?: number }>('risk-rules', {});
    const limit = Number(rules.messagePerMinute ?? MESSAGE_PER_MINUTE_LIMIT) || MESSAGE_PER_MINUTE_LIMIT;
    const minuteAgo = new Date(Date.now() - 60_000);
    const recent = await this.prisma.message.count({
      where: { senderUserId: userId, createdAt: { gte: minuteAgo } },
    });
    if (recent >= limit) {
      throw new HttpException({ code: ERROR_CODES.RATE_LIMITED, message: `发送过于频繁（${limit} 条/分钟）` }, 429);
    }
    const message = await this.prisma.message.create({
      data: { conversationId, senderUserId: userId, content },
      include: { sender: true },
    });
    const others = participants.filter((p) => p !== userId);
    await this.notifications.pushMany(others, 'NEW_MESSAGE', { conversationId, messageId: message.id });
    const view = this.view(message, userId);
    return view;
  }

  private async assertParticipant(conversationId: string, userId: string): Promise<string[]> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: { select: { userId: true } } },
    });
    if (!conversation) {
      throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '会话不存在' });
    }
    const participants = conversation.participants.map((p) => p.userId);
    if (!participants.includes(userId)) {
      throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '会话不存在' });
    }
    if (conversation.status !== 'ACTIVE') {
      throw new BadRequestException({ code: ERROR_CODES.RESOURCE_CONFLICT, message: '会话已关闭' });
    }
    return participants;
  }

  private view(
    message: { id: string; conversationId: string; content: string; createdAt: Date; senderUserId: string; sender: { id: string; nickname: string; avatarUrl: string | null } },
    viewerId: string,
  ): MessageView {
    const hits = riskKeywordsHit(message.content);
    return {
      id: message.id,
      conversationId: message.conversationId,
      sender: { id: message.sender.id, nickname: message.sender.nickname, avatarUrl: message.sender.avatarUrl },
      content: message.content,
      isMine: message.senderUserId === viewerId,
      riskTip: hits.length > 0 ? RISK_TIP : null,
      createdAt: message.createdAt.toISOString(),
    };
  }
}
