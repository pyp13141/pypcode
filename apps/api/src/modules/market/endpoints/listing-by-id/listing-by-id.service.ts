import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ERROR_CODES } from '../../../../common/error-codes';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CareOrdersService } from '../../../care/care-orders.service';
import { MarketDealsService } from '../../market-deals.service';
import { LISTING_TRANSITIONS, MARKET_SAFETY_TIPS, validateListingPrice } from '../../market-state';
import { MarketListingDetailView, toListingDetail } from '../../market-view';
import { ListingsService } from '../listings/listings.service';

export interface PatchListingInput {
  title?: string;
  description?: string;
  priceMinor?: number;
  condition?: string;
  areaCode?: string;
  handoverWindow?: string;
  categoryCode?: string;
  images?: string[];
  status?: 'PUBLISHED' | 'EXPIRED';
}

const LISTING_INCLUDE = {
  category: true,
  seller: true,
  media: { select: { mediaAssetId: true, sortOrder: true } },
} satisfies Prisma.MarketListingInclude;

/** GET/PATCH /api/v1/market/listings/:id — 契约：docs/modules/market/listing-by-id.md */
@Injectable()
export class ListingByIdService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CareOrdersService) private readonly care: CareOrdersService,
    @Inject(MarketDealsService) private readonly deals: MarketDealsService,
    @Inject(ListingsService) private readonly listings: ListingsService,
  ) {}

  async get(listingId: string, viewerId?: string): Promise<MarketListingDetailView> {
    const listing = await this.prisma.marketListing.findUnique({ where: { id: listingId }, include: LISTING_INCLUDE });
    const isOwner = listing !== null && listing.sellerUserId === viewerId;
    if (!listing || (!isOwner && listing.status !== 'PUBLISHED')) {
      throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '列表不存在' });
    }
    const trust = await this.care.trustSummaries([listing.sellerUserId]);
    const favorites = await this.deals.favoriteCounts([listing.id]);
    const favorited = viewerId
      ? (await this.prisma.reaction.count({
          where: { userId: viewerId, targetType: 'LISTING', reactionType: 'FAVORITE', targetId: listing.id },
        })) > 0
      : false;
    return toListingDetail(
      listing,
      trust.get(listing.sellerUserId)!,
      favorites.get(listing.id) ?? 0,
      favorited,
      isOwner,
      MARKET_SAFETY_TIPS,
    );
  }

  async patch(listingId: string, userId: string, input: PatchListingInput): Promise<MarketListingDetailView> {
    const listing = await this.prisma.marketListing.findUnique({ where: { id: listingId }, include: LISTING_INCLUDE });
    if (!listing || listing.sellerUserId !== userId) {
      throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '列表不存在' });
    }
    const keyFieldChange =
      input.title !== undefined || input.description !== undefined || input.priceMinor !== undefined || input.images !== undefined;
    if (['SOLD', 'REMOVED'].includes(listing.status) && keyFieldChange) {
      throw new ForbiddenException({
        code: ERROR_CODES.RESOURCE_FORBIDDEN,
        message: '已售出/已下架的列表不可修改价格、描述等关键字段（如需重新出售请新建列表）',
      });
    }

    const effectiveType = listing.listingType;
    const effectivePrice = input.priceMinor !== undefined ? input.priceMinor : listing.priceMinor === null ? null : Number(listing.priceMinor);
    const priceError = validateListingPrice(effectiveType, effectivePrice);
    if (priceError) throw new BadRequestException({ code: ERROR_CODES.LISTING_PRICE_INVALID, message: priceError });

    let categoryId = listing.categoryId;
    let riskLevel = listing.category.riskLevel;
    if (input.categoryCode && input.categoryCode !== listing.category.code) {
      const category = await this.prisma.marketCategory.findUnique({ where: { code: input.categoryCode } });
      if (!category) {
        throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: '分类不存在' });
      }
      if (category.status !== 'ACTIVE') {
        throw new ForbiddenException({ code: ERROR_CODES.LISTING_CATEGORY_RESTRICTED, message: '该分类暂不接受发布' });
      }
      categoryId = category.id;
      riskLevel = category.riskLevel;
    }

    let nextStatus = listing.status;
    if (input.status && input.status !== listing.status) {
      if (!(LISTING_TRANSITIONS[listing.status] ?? []).includes(input.status)) {
        throw new BadRequestException({
          code: ERROR_CODES.REQUEST_VALIDATION_FAILED,
          message: `不允许的状态流转：${listing.status} → ${input.status}`,
        });
      }
      // 主动上架时：HIGH 风险类目仍进入人工审核
      nextStatus = input.status === 'PUBLISHED' && riskLevel === 'HIGH' ? 'PENDING_REVIEW' : input.status;
    }
    if (input.images) {
      await this.listings.assertOwnedImages(userId, input.images);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (input.images) {
        await tx.marketListingMedia.deleteMany({ where: { listingId } });
      }
      await tx.marketListing.update({
        where: { id: listingId },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.priceMinor !== undefined ? { priceMinor: BigInt(input.priceMinor) } : {}),
          ...(input.condition !== undefined ? { condition: input.condition } : {}),
          ...(input.areaCode !== undefined ? { areaCode: input.areaCode } : {}),
          ...(input.handoverWindow !== undefined ? { handoverWindow: input.handoverWindow } : {}),
          categoryId,
          status: nextStatus,
          ...(input.images
            ? { media: { create: input.images.map((mediaAssetId, index) => ({ mediaAssetId, sortOrder: index })) } }
            : {}),
        },
      });
      return tx.marketListing.findUniqueOrThrow({ where: { id: listingId }, include: LISTING_INCLUDE });
    });

    const trust = await this.care.trustSummaries([userId]);
    const favorites = await this.deals.favoriteCounts([listingId]);
    return toListingDetail(updated, trust.get(userId)!, favorites.get(listingId) ?? 0, false, true, MARKET_SAFETY_TIPS);
  }
}
