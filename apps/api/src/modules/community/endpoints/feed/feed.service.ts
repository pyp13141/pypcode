import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ERROR_CODES } from '../../../../common/error-codes';
import { Paginated, paginate, parsePagination } from '../../../../common/pagination';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CommunitySharedService } from '../../community-shared.service';
import { PostView, toPostView } from '../../community-view';

const FEED_TABS = ['recommended', 'following', 'latest'] as const;
const RECOMMEND_POOL = 200;

/** GET /api/v1/community/feed — 契约：docs/modules/community/feed.md */
@Injectable()
export class FeedService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CommunitySharedService) private readonly shared: CommunitySharedService,
  ) {}

  async feed(tabRaw: string | undefined, pageRaw: string | undefined, pageSizeRaw: string | undefined, viewerId?: string): Promise<Paginated<PostView>> {
    const tab = tabRaw ?? 'recommended';
    if (!(FEED_TABS as readonly string[]).includes(tab)) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: 'tab 需为 recommended/following/latest' });
    }
    if (tab === 'following' && !viewerId) {
      throw new UnauthorizedException({ code: ERROR_CODES.AUTH_REQUIRED, message: '关注流需要登录' });
    }
    const { page, pageSize, skip, take } = parsePagination({ page: pageRaw, pageSize: pageSizeRaw });
    const visibility = await this.shared.postVisibilityWhere(viewerId);

    let where: Prisma.PostWhereInput = visibility;
    if (tab === 'following') {
      const follows = await this.prisma.follow.findMany({ where: { followerUserId: viewerId! }, select: { followedUserId: true } });
      where = { AND: [visibility, { authorUserId: { in: follows.map((f) => f.followedUserId) } }] };
    }

    if (tab !== 'recommended') {
      const [total, rows] = await Promise.all([
        this.prisma.post.count({ where }),
        this.prisma.post.findMany({
          where,
          include: { author: true, media: { select: { mediaAssetId: true, sortOrder: true } } },
          orderBy: { createdAt: 'desc' },
          skip,
          take,
        }),
      ]);
      return this.toPage(rows, viewerId, page, pageSize, total);
    }

    // recommended：取近期池按互动加权排序（产品 12.2：可解释规则，不用纯评分）
    const pool = await this.prisma.post.findMany({
      where,
      include: { author: true, media: { select: { mediaAssetId: true, sortOrder: true } } },
      orderBy: { createdAt: 'desc' },
      take: RECOMMEND_POOL,
    });
    const counts = await this.shared.interactionCounts(pool.map((p) => p.id));
    const scored = pool
      .map((post) => {
        const c = counts.get(post.id)!;
        return { post, score: c.favoriteCount * 3 + c.likeCount * 2 + c.commentCount * 2 };
      })
      .sort((a, b) => b.score - a.score || b.post.createdAt.getTime() - a.post.createdAt.getTime());
    const pageRows = scored.slice(skip, skip + take).map((s) => s.post);
    return this.toPage(pageRows, viewerId, page, pageSize, scored.length);
  }

  private async toPage(
    rows: { id: string }[],
    viewerId: string | undefined,
    page: number,
    pageSize: number,
    total: number,
  ): Promise<Paginated<PostView>> {
    type FullPost = Prisma.PostGetPayload<{ include: { author: true; media: { select: { mediaAssetId: true; sortOrder: true } } } }>;
    const [counts, flags] = await Promise.all([
      this.shared.interactionCounts(rows.map((r) => r.id)),
      this.shared.myFlags(viewerId, rows.map((r) => r.id)),
    ]);
    const items = (rows as FullPost[]).map((post) =>
      toPostView(post, viewerId, counts.get(post.id)!, flags.get(post.id)!),
    );
    return paginate(items, page, pageSize, total);
  }
}
