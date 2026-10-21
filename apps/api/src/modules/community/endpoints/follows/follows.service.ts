import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ERROR_CODES } from '../../../../common/error-codes';
import { PrismaService } from '../../../../prisma/prisma.service';
import { NotificationsService } from '../../../notifications/notifications.service';

export interface FollowView {
  userId: string;
  following: boolean;
  followerCount: number;
}

/**
 * PUT/DELETE /api/v1/community/users/:userId/follow — 契约：docs/modules/community/follows.md
 * 幂等；禁自关注（400）；被关注者收到一次性通知。
 */
@Injectable()
export class FollowsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  async follow(followerUserId: string, followedUserId: string): Promise<FollowView> {
    if (followerUserId === followedUserId) {
      throw new BadRequestException({ code: ERROR_CODES.SELF_FOLLOW_NOT_ALLOWED, message: '不能关注自己' });
    }
    const target = await this.prisma.user.findFirst({ where: { id: followedUserId, deletedAt: null }, select: { id: true } });
    if (!target) {
      throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '用户不存在' });
    }
    const existing = await this.prisma.follow.findUnique({
      where: { followerUserId_followedUserId: { followerUserId, followedUserId } },
      select: { followerUserId: true },
    });
    if (!existing) {
      await this.prisma.follow.create({ data: { followerUserId, followedUserId } });
      await this.notifications.push(followedUserId, 'NEW_FOLLOWER', { followerUserId });
    }
    return this.view(followedUserId, true);
  }

  async unfollow(followerUserId: string, followedUserId: string): Promise<FollowView> {
    await this.prisma.follow.deleteMany({ where: { followerUserId, followedUserId } });
    return this.view(followedUserId, false);
  }

  private async view(followedUserId: string, following: boolean): Promise<FollowView> {
    const followerCount = await this.prisma.follow.count({ where: { followedUserId } });
    return { userId: followedUserId, following, followerCount };
  }
}
