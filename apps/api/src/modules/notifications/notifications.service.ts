import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * 站内通知（API §5 GET /notifications）：
 * 业务侧在关键事件调用 push()（订单/交易/社区/举报结果）。
 * 设计约束：通知失败不得影响主流程（捕获并记日志）；payload_json 只存业务引用，不存敏感明文。
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async push(userId: string, type: string, payload: Record<string, unknown> = {}): Promise<void> {
    try {
      await this.prisma.notification.create({
        data: { userId, type, payloadJson: payload as Prisma.InputJsonValue },
      });
    } catch (error) {
      this.logger.warn(`通知写入失败 user=${userId} type=${type}: ${String(error)}`);
    }
  }

  async pushMany(userIds: string[], type: string, payload: Record<string, unknown> = {}): Promise<void> {
    await Promise.all([...new Set(userIds)].map((userId) => this.push(userId, type, payload)));
  }
}
