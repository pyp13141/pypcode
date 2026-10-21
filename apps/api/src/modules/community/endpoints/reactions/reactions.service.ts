import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ERROR_CODES } from '../../../../common/error-codes';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CommunitySharedService } from '../../community-shared.service';

export interface ReactionResultView {
  targetType: string;
  targetId: string;
  reactionType: string;
  reacted: boolean;
  count: number;
}

/**
 * POST/DELETE /api/v1/community/reactions — 契约：docs/modules/community/reactions.md
 * 四元组唯一（幂等）；目标存在且可见由服务端校验；DELETE 为 D-013 补口（取消点赞/收藏）。
 */
@Injectable()
export class ReactionsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CommunitySharedService) private readonly shared: CommunitySharedService,
  ) {}

  async react(userId: string, targetType: string, targetId: string, reactionType: string): Promise<ReactionResultView> {
    await this.assertTarget(userId, targetType, targetId);
    await this.prisma.reaction.upsert({
      where: { userId_targetType_targetId_reactionType: { userId, targetType, targetId, reactionType } },
      create: { userId, targetType, targetId, reactionType },
      update: {},
    });
    return this.view(targetType, targetId, reactionType, true);
  }

  async unreact(userId: string, targetType: string, targetId: string, reactionType: string): Promise<ReactionResultView> {
    await this.prisma.reaction.deleteMany({ where: { userId, targetType, targetId, reactionType } });
    return this.view(targetType, targetId, reactionType, false);
  }

  private async assertTarget(viewerId: string | undefined, targetType: string, targetId: string): Promise<void> {
    if (targetType === 'POST') {
      await this.shared.requireVisiblePost(targetId, viewerId);
      return;
    }
    if (targetType === 'COMMENT') {
      const comment = await this.prisma.comment.findFirst({ where: { id: targetId, status: 'VISIBLE' }, select: { postId: true } });
      if (!comment) throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '目标不存在' });
      await this.shared.requireVisiblePost(comment.postId, viewerId);
      return;
    }
    throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: 'targetType 需为 POST/COMMENT' });
  }

  private async view(targetType: string, targetId: string, reactionType: string, reacted: boolean): Promise<ReactionResultView> {
    const count = await this.prisma.reaction.count({ where: { targetType, targetId, reactionType } });
    return { targetType, targetId, reactionType, reacted, count };
  }
}
