/**
 * market 视图白名单：对外 DTO 一律经这里构造；金额 bigint → number。
 * 图片只返回 mediaId 列表（读取经 /media/:id/url 短时签名 + 业务授权校验）。
 */
import type { MarketCategory, MarketDeal, MarketListing, User } from '@prisma/client';
import type { TrustSummary } from '../care/care-view';

export interface MarketUserBrief {
  id: string;
  nickname: string;
  avatarUrl: string | null;
}

export interface MarketCategoryView {
  code: string;
  name: string;
  riskLevel: string;
}

export interface MarketListingSummaryView {
  id: string;
  listingType: string;
  category: MarketCategoryView;
  title: string;
  description: string;
  priceMinor: number | null;
  condition: string | null;
  areaCode: string;
  handoverWindow: string | null;
  status: string;
  seller: MarketUserBrief;
  sellerTrust: TrustSummary;
  imageMediaIds: string[];
  favoriteCount: number;
  isFavorited: boolean;
  createdAt: string;
}

export interface MarketListingDetailView extends MarketListingSummaryView {
  isOwner: boolean;
  /** 发布前必须先看的安全提示（产品 5.2/7.3） */
  safetyTips: string[];
}

export interface MarketDealView {
  id: string;
  listingId: string;
  status: string;
  role: 'BUYER' | 'SELLER';
  buyer: MarketUserBrief;
  seller: MarketUserBrief;
  listing: {
    id: string;
    title: string;
    listingType: string;
    priceMinor: number | null;
    areaCode: string;
    coverMediaId: string | null;
  };
  handoverAt: string | null;
  handoverArea: string | null;
  agreement: unknown;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReasonCode: string | null;
  conversationId: string | null;
  createdAt: string;
}

export function toMinor(value: bigint | null | undefined): number | null {
  return value === null || value === undefined ? null : Number(value);
}

export function toMarketUserBrief(user: Pick<User, 'id' | 'nickname' | 'avatarUrl'>): MarketUserBrief {
  return { id: user.id, nickname: user.nickname, avatarUrl: user.avatarUrl };
}

export function toCategoryView(category: Pick<MarketCategory, 'code' | 'name' | 'riskLevel'>): MarketCategoryView {
  return { code: category.code, name: category.name, riskLevel: category.riskLevel };
}

export function toListingSummary(
  listing: MarketListing & { category: MarketCategory; seller: User; media: { mediaAssetId: string; sortOrder: number }[] },
  trust: TrustSummary,
  favoriteCount: number,
  isFavorited: boolean,
): MarketListingSummaryView {
  return {
    id: listing.id,
    listingType: listing.listingType,
    category: toCategoryView(listing.category),
    title: listing.title,
    description: listing.description,
    priceMinor: toMinor(listing.priceMinor),
    condition: listing.condition,
    areaCode: listing.areaCode,
    handoverWindow: listing.handoverWindow,
    status: listing.status,
    seller: toMarketUserBrief(listing.seller),
    sellerTrust: trust,
    imageMediaIds: [...listing.media].sort((a, b) => a.sortOrder - b.sortOrder).map((m) => m.mediaAssetId),
    favoriteCount,
    isFavorited,
    createdAt: listing.createdAt.toISOString(),
  };
}

export function toListingDetail(
  listing: MarketListing & { category: MarketCategory; seller: User; media: { mediaAssetId: string; sortOrder: number }[] },
  trust: TrustSummary,
  favoriteCount: number,
  isFavorited: boolean,
  isOwner: boolean,
  safetyTips: string[],
): MarketListingDetailView {
  return {
    ...toListingSummary(listing, trust, favoriteCount, isFavorited),
    isOwner,
    safetyTips,
  };
}

export function toDealView(
  deal: MarketDeal & {
    buyer: User;
    seller: User;
    listing: MarketListing & { media?: { mediaAssetId: string; sortOrder: number }[] };
    conversation?: { id: string } | null;
  },
  callerId: string,
): MarketDealView {
  const role: 'BUYER' | 'SELLER' = deal.buyerUserId === callerId ? 'BUYER' : 'SELLER';
  const cover = deal.listing.media?.length
    ? [...deal.listing.media].sort((a, b) => a.sortOrder - b.sortOrder)[0]!.mediaAssetId
    : null;
  return {
    id: deal.id,
    listingId: deal.listingId,
    status: deal.status,
    role,
    buyer: toMarketUserBrief(deal.buyer),
    seller: toMarketUserBrief(deal.seller),
    listing: {
      id: deal.listing.id,
      title: deal.listing.title,
      listingType: deal.listing.listingType,
      priceMinor: toMinor(deal.listing.priceMinor),
      areaCode: deal.listing.areaCode,
      coverMediaId: cover,
    },
    handoverAt: deal.handoverAt?.toISOString() ?? null,
    handoverArea: deal.handoverArea,
    agreement: deal.agreementJson,
    completedAt: deal.completedAt?.toISOString() ?? null,
    cancelledAt: deal.cancelledAt?.toISOString() ?? null,
    cancelReasonCode: deal.cancelReasonCode,
    conversationId: deal.conversation?.id ?? null,
    createdAt: deal.createdAt.toISOString(),
  };
}
