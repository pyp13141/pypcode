import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ERROR_CODES } from '../../../../common/error-codes';
import { Paginated, paginate, parsePagination } from '../../../../common/pagination';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CareOrdersService } from '../../../care/care-orders.service';
import { MarketDealsService } from '../../market-deals.service';
import { LISTING_TYPES, validateListingPrice } from '../../market-state';
import { MarketListingSummaryView, toListingSummary } from '../../market-view';

export interface CreateListingInput {
  listingType: string;
  categoryCode: string;
  title: string;
  description: string;
  priceMinor?: number;
  condition?: string;
  areaCode: string;
  handoverWindow?: string;
  images: string[];
}

export interface ListListingsQuery {
  listingType?: string;
  categoryCode?: string;
  areaCode?: string;
  priceMin?: string;
  priceMax?: string;
  keyword?: string;
  mine?: string;
  page?: string;
  pageSize?: string;
}

const LISTING_INCLUDE = {
  category: true,
  seller: true,
  media: { select: { mediaAssetId: true, sortOrder: true } },
} satisfies Prisma.MarketListingInclude;

/**
 * GET/POST /api/v1/market/listings — 契约：docs/modules/market/listings.md
 * 公开列表仅 PUBLISHED；HIGH 风险类目（宠物食品/药品）发布进 PENDING_REVIEW 人工审核（产品 6.4）。
 */
@Injectable()
export class ListingsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CareOrdersService) private readonly care: CareOrdersService,
    @Inject(MarketDealsService) private readonly deals: MarketDealsService,
  ) {}

  async list(query: ListListingsQuery, viewerId?: string): Promise<Paginated<MarketListingSummaryView>> {
    const { page, pageSize, skip, take } = parsePagination(query);
    const mine = query.mine === 'true';
    if (query.listingType && !(LISTING_TYPES as readonly string[]).includes(query.listingType)) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: 'listingType 不合法' });
    }
    const priceMin = query.priceMin !== undefined ? Number(query.priceMin) : null;
    const priceMax = query.priceMax !== undefined ? Number(query.priceMax) : null;
    if ((priceMin !== null && !Number.isFinite(priceMin)) || (priceMax !== null && !Number.isFinite(priceMax))) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: '价格区间不合法' });
    }

    const where: Prisma.MarketListingWhereInput = {
      status: mine ? undefined : 'PUBLISHED',
      ...(mine ? { sellerUserId: viewerId } : {}),
      ...(query.listingType ? { listingType: query.listingType } : {}),
      ...(query.areaCode ? { areaCode: query.areaCode } : {}),
      ...(query.categoryCode ? { category: { code: query.categoryCode } } : {}),
      ...(priceMin !== null || priceMax !== null
        ? { priceMinor: { ...(priceMin !== null ? { gte: BigInt(Math.floor(priceMin)) } : {}), ...(priceMax !== null ? { lte: BigInt(Math.floor(priceMax)) } : {}) } }
        : {}),
      ...(query.keyword
        ? { OR: [{ title: { contains: query.keyword } }, { description: { contains: query.keyword } }] }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.marketListing.count({ where }),
      this.prisma.marketListing.findMany({ where, include: LISTING_INCLUDE, orderBy: { createdAt: 'desc' }, skip, take }),
    ]);
    const trust = await this.care.trustSummaries(rows.map((r) => r.sellerUserId));
    const favorites = await this.deals.favoriteCounts(rows.map((r) => r.id));
    const favByMe = viewerId ? await this.myFavorites(viewerId, rows.map((r) => r.id)) : new Set<string>();
    const items = rows.map((listing) =>
      toListingSummary(
        listing,
        trust.get(listing.sellerUserId)!,
        favorites.get(listing.id) ?? 0,
        favByMe.has(listing.id),
      ),
    );
    return paginate(items, page, pageSize, total);
  }

  async create(sellerUserId: string, input: CreateListingInput): Promise<MarketListingSummaryView> {
    const priceError = validateListingPrice(input.listingType, input.priceMinor);
    if (priceError) throw new BadRequestException({ code: ERROR_CODES.LISTING_PRICE_INVALID, message: priceError });

    const category = await this.prisma.marketCategory.findUnique({ where: { code: input.categoryCode } });
    if (!category) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: '分类不存在' });
    }
    if (category.status !== 'ACTIVE') {
      throw new ForbiddenException({ code: ERROR_CODES.LISTING_CATEGORY_RESTRICTED, message: '该分类暂不接受发布' });
    }
    await this.assertOwnedImages(sellerUserId, input.images);

    // HIGH 风险类目必须人审（产品 6.4：宠物食品/药品），其余发布即 PUBLISHED
    const status = category.riskLevel === 'HIGH' ? 'PENDING_REVIEW' : 'PUBLISHED';
    const listing = await this.prisma.marketListing.create({
      data: {
        sellerUserId,
        listingType: input.listingType,
        categoryId: category.id,
        title: input.title,
        description: input.description,
        priceMinor: input.priceMinor === undefined ? null : BigInt(input.priceMinor),
        condition: input.condition ?? null,
        areaCode: input.areaCode,
        handoverWindow: input.handoverWindow ?? null,
        status,
        media: {
          create: input.images.map((mediaAssetId, index) => ({ mediaAssetId, sortOrder: index })),
        },
      },
      include: LISTING_INCLUDE,
    });
    const trust = await this.care.trustSummaries([sellerUserId]);
    return toListingSummary(listing, trust.get(sellerUserId)!, 0, false);
  }

  /** 图片必须是本人、purpose=LISTING_IMAGE 且已完成上传（finalize） */
  async assertOwnedImages(userId: string, mediaIds: string[]): Promise<void> {
    if (mediaIds.length === 0) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: '至少上传 1 张图片（1-9 张）' });
    }
    if (new Set(mediaIds).size !== mediaIds.length) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: '图片不能重复' });
    }
    const rows = await this.prisma.mediaAsset.findMany({
      where: { id: { in: mediaIds }, ownerUserId: userId, purpose: 'LISTING_IMAGE', finalizedAt: { not: null } },
      select: { id: true },
    });
    if (rows.length !== mediaIds.length) {
      throw new BadRequestException({
        code: ERROR_CODES.REQUEST_VALIDATION_FAILED,
        message: '图片须为本人的 LISTING_IMAGE 类型且已完成上传登记',
      });
    }
  }

  private async myFavorites(userId: string, listingIds: string[]): Promise<Set<string>> {
    if (listingIds.length === 0) return new Set();
    const rows = await this.prisma.reaction.findMany({
      where: { userId, targetType: 'LISTING', reactionType: 'FAVORITE', targetId: { in: listingIds } },
      select: { targetId: true },
    });
    return new Set(rows.map((r) => r.targetId));
  }
}
