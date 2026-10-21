import { BadRequestException, HttpException, Inject, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../../../../common/error-codes';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CommunitySharedService } from '../../community-shared.service';
import { NEW_ACCOUNT_HOURS, POST_HOURLY_LIMIT, riskKeywordsHit } from '../../community-state';
import { PostView, toPostView } from '../../community-view';

export interface CreatePostInput {
  content: string;
  images?: string[];
  topicIds?: string[];
}

/**
 * POST /api/v1/community/posts — 契约：docs/modules/community/posts.md
 * 内容检查：新账号（24h 内）或命中风险关键词 → PENDING 人工审核；发布频率 10 次/小时。
 * 话题标签（topicIds）接受但暂不落库（话题体系二期，D-013）。
 */
@Injectable()
export class PostsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CommunitySharedService) private readonly shared: CommunitySharedService,
  ) {}

  async create(userId: string, input: CreatePostInput): Promise<PostView> {
    const hourAgo = new Date(Date.now() - 3600_000);
    const recent = await this.prisma.post.count({ where: { authorUserId: userId, createdAt: { gte: hourAgo } } });
    if (recent >= POST_HOURLY_LIMIT) {
      throw new HttpException({ code: ERROR_CODES.RATE_LIMITED, message: `发布过于频繁（${POST_HOURLY_LIMIT} 条/小时）` }, 429);
    }
    const images = input.images ?? [];
    if (images.length > 0) {
      const owned = await this.prisma.mediaAsset.findMany({
        where: { id: { in: images }, ownerUserId: userId, purpose: 'POST_IMAGE', finalizedAt: { not: null } },
        select: { id: true },
      });
      if (owned.length !== new Set(images).size) {
        throw new BadRequestException({
          code: ERROR_CODES.REQUEST_VALIDATION_FAILED,
          message: '图片须为本人的 POST_IMAGE 类型且已完成上传登记',
        });
      }
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { createdAt: true } });
    const isNewAccount = Date.now() - user.createdAt.getTime() < NEW_ACCOUNT_HOURS * 3600_000;
    const keywords = riskKeywordsHit(input.content);
    const moderationStatus = isNewAccount || keywords.length > 0 ? 'PENDING' : 'APPROVED';

    const post = await this.prisma.post.create({
      data: {
        authorUserId: userId,
        postType: 'NORMAL',
        content: input.content,
        visibility: 'PUBLIC',
        moderationStatus,
        media: { create: images.map((mediaAssetId, index) => ({ mediaAssetId, sortOrder: index })) },
      },
      include: { author: true, media: { select: { mediaAssetId: true, sortOrder: true } } },
    });
    await this.shared.awardBadge(userId, 'COMMUNITY_FIRST', { postId: post.id });
    return toPostView(post, userId, { likeCount: 0, favoriteCount: 0, commentCount: 0 }, { liked: false, favorited: false });
  }
}
