import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ERROR_CODES } from '../../common/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { toCommunityUserBrief, toCommentView } from './community-view';

/**
 * community 模块级共享规则：
 * - 可见性（公开/关注可见/私密 + 审核态 + 软删 + 屏蔽双向过滤 + 个人隐藏偏好）
 * - 互动计数与"我是否点过"
 * - 徽章发放（幂等）
 */
@Injectable()
export class CommunitySharedService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** 与我有屏蔽关系的用户 id（双向：我屏蔽的人 + 屏蔽我的人） */
  async blockedUserIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.userBlock.findMany({
      where: { OR: [{ blockerUserId: userId }, { blockedUserId: userId }] },
      select: { blockerUserId: true, blockedUserId: true },
    });
    const ids = new Set<string>();
    for (const row of rows) {
      ids.add(row.blockerUserId === userId ? row.blockedUserId : row.blockerUserId);
    }
    return [...ids];
  }

  /** 帖子可见条件（含作者可见自己的待审/私密帖） */
  async postVisibilityWhere(viewerId?: string): Promise<Prisma.PostWhereInput> {
    const base: Prisma.PostWhereInput = {
      deletedAt: null,
      hiddenAt: null,
      author: { status: 'ACTIVE', deletedAt: null },
    };
    if (!viewerId) {
      return { ...base, moderationStatus: 'APPROVED', visibility: 'PUBLIC' };
    }
    const blocked = await this.blockedUserIds(viewerId);
    const hiddenRows = await this.prisma.postHide.findMany({ where: { userId: viewerId }, select: { postId: true } });
    return {
      ...base,
      authorUserId: { notIn: blocked },
      ...(hiddenRows.length > 0 ? { id: { notIn: hiddenRows.map((h) => h.postId) } } : {}),
      OR: [
        { moderationStatus: 'APPROVED', visibility: 'PUBLIC' },
        { moderationStatus: 'APPROVED', visibility: 'FOLLOWERS', author: { followsFollowedBy: { some: { followerUserId: viewerId } } } },
        { authorUserId: viewerId },
      ],
    };
  }

  /** 帖子详情取数：可见性不满足与不存在一律 404（不泄露存在性） */
  async requireVisiblePost(postId: string, viewerId?: string) {
    const where = await this.postVisibilityWhere(viewerId);
    const post = await this.prisma.post.findFirst({
      where: { AND: [{ id: postId }, where] },
      include: { author: true, media: { select: { mediaAssetId: true, sortOrder: true } }, helpPost: true },
    });
    if (!post) {
      throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '内容不存在' });
    }
    return post;
  }

  /** 批量互动计数（点赞/收藏/评论） */
  async interactionCounts(postIds: string[]): Promise<Map<string, { likeCount: number; favoriteCount: number; commentCount: number }>> {
    const result = new Map<string, { likeCount: number; favoriteCount: number; commentCount: number }>();
    if (postIds.length === 0) return result;
    const [reactions, comments] = await Promise.all([
      this.prisma.reaction.groupBy({
        by: ['targetId', 'reactionType'],
        where: { targetType: 'POST', targetId: { in: postIds } },
        _count: { _all: true },
      }),
      this.prisma.comment.groupBy({
        by: ['postId'],
        where: { postId: { in: postIds }, status: 'VISIBLE' },
        _count: { _all: true },
      }),
    ]);
    for (const id of postIds) result.set(id, { likeCount: 0, favoriteCount: 0, commentCount: 0 });
    for (const row of reactions) {
      const item = result.get(row.targetId)!;
      if (row.reactionType === 'LIKE') item.likeCount = row._count._all;
      if (row.reactionType === 'FAVORITE') item.favoriteCount = row._count._all;
    }
    for (const row of comments) {
      result.get(row.postId)!.commentCount = row._count._all;
    }
    return result;
  }

  /** 我对这批帖子的点赞/收藏状态 */
  async myFlags(userId: string | undefined, postIds: string[]): Promise<Map<string, { liked: boolean; favorited: boolean }>> {
    const result = new Map<string, { liked: boolean; favorited: boolean }>();
    for (const id of postIds) result.set(id, { liked: false, favorited: false });
    if (!userId || postIds.length === 0) return result;
    const rows = await this.prisma.reaction.findMany({
      where: { userId, targetType: 'POST', targetId: { in: postIds } },
      select: { targetId: true, reactionType: true },
    });
    for (const row of rows) {
      const item = result.get(row.targetId)!;
      if (row.reactionType === 'LIKE') item.liked = true;
      if (row.reactionType === 'FAVORITE') item.favorited = true;
    }
    return result;
  }

  /** 帖子详情：内容 + 评论（两级扁平，可见评论） */
  async postDetailPayload(postId: string, viewerId?: string) {
    const post = await this.requireVisiblePost(postId, viewerId);
    const [countsMap, flagsMap, comments] = await Promise.all([
      this.interactionCounts([postId]),
      this.myFlags(viewerId, [postId]),
      this.prisma.comment.findMany({
        where: { postId, status: 'VISIBLE' },
        include: { author: true },
        orderBy: { createdAt: 'asc' },
        take: 100,
      }),
    ]);
    return {
      post,
      counts: countsMap.get(postId)!,
      flags: flagsMap.get(postId)!,
      comments: comments.map((c) => toCommentView(c, viewerId)),
    };
  }

  /** 徽章发放（幂等：UNIQUE(user_id,badge_id) + skipDuplicates） */
  async awardBadge(userId: string, code: string, metadata: Record<string, unknown> = {}): Promise<void> {
    const badge = await this.prisma.badge.findUnique({ where: { code }, select: { id: true, isActive: true } });
    if (!badge || !badge.isActive) return;
    await this.prisma.userBadge.createMany({
      data: [{ userId, badgeId: badge.id, metadataJson: metadata as Prisma.InputJsonValue }],
      skipDuplicates: true,
    });
  }
}

export { toCommunityUserBrief };
