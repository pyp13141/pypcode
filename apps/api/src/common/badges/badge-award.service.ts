import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * 徽章发放（全局，幂等）：UNIQUE(user_id,badge_id) + skipDuplicates。
 * 发放点：互助订单完成（CARE_FIRST/CARE_VETERAN）、首次评价（REVIEW_FIRST）、首发帖（COMMUNITY_FIRST，社区模块）。
 */
@Injectable()
export class BadgeAwardService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async award(userId: string, code: string, metadata: Record<string, unknown> = {}): Promise<void> {
    const badge = await this.prisma.badge.findUnique({ where: { code }, select: { id: true, isActive: true } });
    if (!badge || !badge.isActive) return;
    await this.prisma.userBadge.createMany({
      data: [{ userId, badgeId: badge.id, metadataJson: metadata as Prisma.InputJsonValue }],
      skipDuplicates: true,
    });
  }

  /** 互助达人：累计完成单数达阈值时发放（幂等，重复调用无害） */
  async awardCareMilestones(providerUserId: string, completedCount: number, orderId: string): Promise<void> {
    await this.award(providerUserId, 'CARE_FIRST', { orderId });
    if (completedCount >= 5) {
      await this.award(providerUserId, 'CARE_VETERAN', { completedCount });
    }
  }
}
