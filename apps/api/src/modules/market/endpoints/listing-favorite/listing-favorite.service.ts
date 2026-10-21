import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ERROR_CODES } from '../../../../common/error-codes';
import { PrismaService } from '../../../../prisma/prisma.service';

export interface FavoriteView {
  listingId: string;
  favorited: boolean;
  favoriteCount: number;
}

/**
 * PUT/DELETE /api/v1/market/listings/:id/favorite — 契约：docs/modules/market/listing-favorite.md
 * 幂等（PUT 重复=已收藏；DELETE 重复=已取消）；复用 reactions 唯一约束（D-012）。
 */
@Injectable()
export class ListingFavoriteService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async favorite(listingId: string, userId: string): Promise<FavoriteView> {
    await this.assertVisible(listingId);
    await this.prisma.reaction.upsert({
      where: {
        userId_targetType_targetId_reactionType: {
          userId,
          targetType: 'LISTING',
          targetId: listingId,
          reactionType: 'FAVORITE',
        },
      },
      create: { userId, targetType: 'LISTING', targetId: listingId, reactionType: 'FAVORITE' },
      update: {},
    });
    return this.view(listingId, true);
  }

  async unfavorite(listingId: string, userId: string): Promise<FavoriteView> {
    await this.prisma.reaction.deleteMany({
      where: { userId, targetType: 'LISTING', targetId: listingId, reactionType: 'FAVORITE' },
    });
    return this.view(listingId, false);
  }

  private async assertVisible(listingId: string): Promise<void> {
    const listing = await this.prisma.marketListing.findUnique({ where: { id: listingId }, select: { status: true } });
    if (!listing || listing.status !== 'PUBLISHED') {
      throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '列表不存在' });
    }
  }

  private async view(listingId: string, favorited: boolean): Promise<FavoriteView> {
    const favoriteCount = await this.prisma.reaction.count({
      where: { targetType: 'LISTING', reactionType: 'FAVORITE', targetId: listingId },
    });
    return { listingId, favorited, favoriteCount };
  }
}
