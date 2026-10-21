import { BadRequestException, HttpException, Inject, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../../../../common/error-codes';
import { Paginated, paginate, parsePagination } from '../../../../common/pagination';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CommunitySharedService } from '../../community-shared.service';
import {
  HELP_CATEGORIES,
  HELP_POST_DAILY_LIMIT,
  NEW_ACCOUNT_HOURS,
  riskKeywordsHit,
} from '../../community-state';
import { HelpPostView, toHelpPostView } from '../../community-view';

export interface CreateHelpPostInput {
  category: string;
  title: string;
  content: string;
  cityId?: string;
  stationId?: string;
  deadlineAt?: string;
}

export interface ListHelpPostsQuery {
  category?: string;
  cityId?: string;
  stationId?: string;
  status?: string;
  page?: string;
  pageSize?: string;
}

const HELP_INCLUDE = { author: true, post: { select: { content: true, moderationStatus: true } } };

/**
 * GET/POST /api/v1/community/help-posts — 契约：docs/modules/community/help-posts.md
 * D-010 两层模型的轻量层：无订单机制，评论+站内响应；分类白名单 PET_CARE/NEIGHBOR。
 */
@Injectable()
export class HelpPostsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CommunitySharedService) private readonly shared: CommunitySharedService,
  ) {}

  async create(userId: string, input: CreateHelpPostInput): Promise<HelpPostView> {
    if (!(HELP_CATEGORIES as readonly string[]).includes(input.category)) {
      throw new BadRequestException({
        code: ERROR_CODES.HELP_CATEGORY_NOT_ALLOWED,
        message: `分类需为 ${HELP_CATEGORIES.join('/')}（跑腿/代办等类目暂不开放）`,
      });
    }
    const dayAgo = new Date(Date.now() - 24 * 3600_000);
    const todayCount = await this.prisma.helpPost.count({ where: { authorUserId: userId, createdAt: { gte: dayAgo } } });
    if (todayCount >= HELP_POST_DAILY_LIMIT) {
      throw new HttpException({ code: ERROR_CODES.RATE_LIMITED, message: `求助帖发布过于频繁（${HELP_POST_DAILY_LIMIT} 篇/天）` }, 429);
    }
    const deadlineAt = input.deadlineAt ? new Date(input.deadlineAt) : null;
    if (input.deadlineAt && Number.isNaN(deadlineAt!.getTime())) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: 'deadlineAt 时间格式不正确' });
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { createdAt: true } });
    const isNewAccount = Date.now() - user.createdAt.getTime() < NEW_ACCOUNT_HOURS * 3600_000;
    const keywords = riskKeywordsHit(`${input.title}\n${input.content}`);
    const moderationStatus = isNewAccount || keywords.length > 0 ? 'PENDING' : 'APPROVED';

    const helpPost = await this.prisma.$transaction(async (tx) => {
      const post = await tx.post.create({
        data: {
          authorUserId: userId,
          postType: 'HELP',
          content: input.content,
          visibility: 'PUBLIC',
          moderationStatus,
        },
      });
      return tx.helpPost.create({
        data: {
          postId: post.id,
          authorUserId: userId,
          category: input.category,
          title: input.title,
          cityId: input.cityId ?? null,
          stationId: input.stationId ?? null,
          deadlineAt,
          status: 'OPEN',
        },
        include: HELP_INCLUDE,
      });
    });
    await this.shared.awardBadge(userId, 'COMMUNITY_FIRST', { helpPostId: helpPost.id });
    return toHelpPostView(helpPost, helpPost.post.content, 0, userId);
  }

  async list(query: ListHelpPostsQuery, viewerId?: string): Promise<Paginated<HelpPostView>> {
    const { page, pageSize, skip, take } = parsePagination(query);
    if (query.category && !(HELP_CATEGORIES as readonly string[]).includes(query.category)) {
      throw new BadRequestException({ code: ERROR_CODES.HELP_CATEGORY_NOT_ALLOWED, message: 'category 不合法' });
    }
    const where = {
      ...(query.category ? { category: query.category } : {}),
      ...(query.cityId ? { cityId: query.cityId } : {}),
      ...(query.stationId ? { stationId: query.stationId } : {}),
      status: query.status ?? 'OPEN',
      post: viewerId
        ? { OR: [{ moderationStatus: 'APPROVED' }, { authorUserId: viewerId }] }
        : { moderationStatus: 'APPROVED' },
    };
    const [total, rows] = await Promise.all([
      this.prisma.helpPost.count({ where }),
      this.prisma.helpPost.findMany({ where, include: HELP_INCLUDE, orderBy: { createdAt: 'desc' }, skip, take }),
    ]);
    const commentCounts = await this.commentCounts(rows.map((r) => r.postId));
    const items = rows.map((row) => toHelpPostView(row, row.post.content, commentCounts.get(row.postId) ?? 0, viewerId));
    return paginate(items, page, pageSize, total);
  }

  private async commentCounts(postIds: string[]): Promise<Map<string, number>> {
    if (postIds.length === 0) return new Map();
    const rows = await this.prisma.comment.groupBy({
      by: ['postId'],
      where: { postId: { in: postIds }, status: 'VISIBLE' },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.postId, r._count._all]));
  }
}
