import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../../../../common/error-codes';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CareOrdersService } from '../../../care/care-orders.service';
import { CommunitySharedService } from '../../community-shared.service';
import { LEADERBOARD_RULES } from '../../community-state';
import { toCommunityUserBrief } from '../../community-view';

const BOARD_TYPES = ['contribution', 'content', 'growth'] as const;
const BOARD_LIMIT = 20;

export interface LeaderboardEntry {
  rank: number;
  score: number;
  user?: { id: string; nickname: string; avatarUrl: string | null };
  postId?: string;
  excerpt?: string;
  completedOrderCount?: number;
  reviewCount?: number;
  petName?: string;
  logCount?: number;
}

/**
 * GET /api/v1/community/leaderboards — 契约：docs/modules/community/leaderboards.md
 * 三类榜单（产品 12.3）：规则随响应下发（页面须可解释）；不售卖排名、无付费加权。
 */
@Injectable()
export class LeaderboardsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CommunitySharedService) private readonly shared: CommunitySharedService,
    @Inject(CareOrdersService) private readonly care: CareOrdersService,
  ) {}

  async board(type: string): Promise<{ type: string; rule: string; entries: LeaderboardEntry[] }> {
    if (!(BOARD_TYPES as readonly string[]).includes(type)) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: 'type 需为 contribution/content/growth' });
    }
    if (type === 'contribution') {
      const rows = await this.prisma.careOrder.groupBy({
        by: ['providerUserId'],
        where: { status: 'COMPLETED' },
        _count: { _all: true },
      });
      const top = rows.sort((a, b) => b._count._all - a._count._all).slice(0, BOARD_LIMIT);
      const trust = await this.care.trustSummaries(top.map((r) => r.providerUserId));
      const users = await this.prisma.user.findMany({
        where: { id: { in: top.map((r) => r.providerUserId) } },
        select: { id: true, nickname: true, avatarUrl: true },
      });
      const userMap = new Map(users.map((u) => [u.id, u]));
      return {
        type,
        rule: LEADERBOARD_RULES.contribution,
        entries: top
          .filter((r) => userMap.has(r.providerUserId))
          .map((r, index) => ({
            rank: index + 1,
            score: r._count._all,
            user: toCommunityUserBrief(userMap.get(r.providerUserId)!),
            completedOrderCount: r._count._all,
            reviewCount: trust.get(r.providerUserId)?.reviewCount ?? 0,
          })),
      };
    }
    if (type === 'content') {
      const posts = await this.prisma.post.findMany({
        where: { moderationStatus: 'APPROVED', deletedAt: null, hiddenAt: null, postType: 'NORMAL' },
        include: { author: true },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
      const counts = await this.shared.interactionCounts(posts.map((p) => p.id));
      const scored = posts
        .map((post) => {
          const c = counts.get(post.id)!;
          return { post, score: c.favoriteCount * 3 + c.likeCount * 2 + c.commentCount * 2 };
        })
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score || b.post.createdAt.getTime() - a.post.createdAt.getTime())
        .slice(0, BOARD_LIMIT);
      return {
        type,
        rule: LEADERBOARD_RULES.content,
        entries: scored.map((s, index) => ({
          rank: index + 1,
          score: s.score,
          user: toCommunityUserBrief(s.post.author),
          postId: s.post.id,
          excerpt: s.post.content.slice(0, 60),
        })),
      };
    }
    // growth：近 30 天健康+情绪记录条数（记录持续性；不按体重/健康状况评判宠物价值，产品 12.3）
    const since = new Date(Date.now() - 30 * 86400_000);
    const [healthRows, moodRows] = await Promise.all([
      this.prisma.petHealthLog.groupBy({ by: ['petId'], where: { recordedAt: { gte: since } }, _count: { _all: true } }),
      this.prisma.petMoodLog.groupBy({ by: ['petId'], where: { observedAt: { gte: since } }, _count: { _all: true } }),
    ]);
    const scoreByPet = new Map<string, number>();
    for (const row of healthRows) scoreByPet.set(row.petId, (scoreByPet.get(row.petId) ?? 0) + row._count._all);
    for (const row of moodRows) scoreByPet.set(row.petId, (scoreByPet.get(row.petId) ?? 0) + row._count._all);
    const petIds = [...scoreByPet.keys()];
    const pets = petIds.length ? await this.prisma.pet.findMany({
      where: { id: { in: petIds }, archivedAt: null },
      select: { id: true, name: true, ownerUserId: true, owner: { select: { id: true, nickname: true, avatarUrl: true } } },
    }) : [];
    const entries = pets
      .map((pet) => ({ pet, score: scoreByPet.get(pet.id) ?? 0 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, BOARD_LIMIT)
      .map((item, index) => ({
        rank: index + 1,
        score: item.score,
        user: toCommunityUserBrief(item.pet.owner),
        petName: item.pet.name,
        logCount: item.score,
      }));
    return { type, rule: LEADERBOARD_RULES.growth, entries };
  }
}
