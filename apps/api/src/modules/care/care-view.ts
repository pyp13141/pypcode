/**
 * care 视图白名单：对外 DTO 一律经这里构造。
 * 硬规则：公开视图绝不含精确地址/门禁/紧急联系人/密文；金额 bigint → number（整数分）。
 */
import type {
  CareApplication,
  CareOffering,
  CareOfferingAvailability,
  CareOrder,
  CareRequest,
  CareVisit,
  User,
} from '@prisma/client';

export interface TrustSummary {
  /** 手机号是否已验证（user_private_profiles.phone_verified_at 非空） */
  phoneVerified: boolean;
  /** 作为服务者的已完成订单数 */
  completedOrderCount: number;
  /** 收到的评价样本量（不含删除） */
  reviewCount: number;
}

export interface PublicUserBrief {
  id: string;
  nickname: string;
  avatarUrl: string | null;
}

export interface AvailabilityView {
  id: string;
  startAt: string;
  endAt: string;
  capacity: number;
  status: string;
}

export interface OfferingSummaryView {
  id: string;
  serviceType: string;
  title: string;
  description: string;
  areaCode: string;
  radiusKm: number | null;
  pricingType: string;
  priceMinor: number | null;
  cancelRule: string;
  status: string;
  provider: PublicUserBrief;
  trust: TrustSummary;
  createdAt: string;
}

export interface OfferingDetailView extends OfferingSummaryView {
  availabilities: AvailabilityView[];
  isOwner: boolean;
  /** 上门服务安全提示（产品文档 7.2；服务端下发统一文案） */
  safetyTips: string[];
}

export interface PetBriefView {
  id: string;
  name: string;
  species: string;
  breed: string | null;
}

export interface RequestView {
  id: string;
  serviceType: string;
  title: string;
  description: string;
  areaCode: string;
  startAt: string;
  endAt: string;
  frequency: string | null;
  pricingType: string;
  priceMinor: number | null;
  cancelRule: string;
  status: string;
  pets: PetBriefView[];
  requester: PublicUserBrief;
  isOwner: boolean;
  createdAt: string;
}

export interface ApplicationView {
  id: string;
  requestId: string;
  applicant: PublicUserBrief;
  message: string;
  proposedPriceMinor: number | null;
  status: string;
  decidedAt: string | null;
  careOrderId: string | null;
  createdAt: string;
}

export interface VisitView {
  id: string;
  seq: number;
  scheduledAt: string;
  startedAt: string | null;
  completedAt: string | null;
  status: string;
  notes: string | null;
}

export interface EvidenceView {
  id: string;
  evidenceType: string;
  mediaAssetId: string | null;
  note: string | null;
  createdAt: string;
}

export interface OrderView {
  id: string;
  orderNo: string;
  status: string;
  /** 当前调用者在订单中的角色 */
  role: 'REQUESTER' | 'PROVIDER';
  pricingType: string;
  priceMinor: number | null;
  termsVersion: string;
  agreedTerms: unknown;
  requester: PublicUserBrief;
  provider: PublicUserBrief;
  confirmedByRequesterAt: string | null;
  confirmedByProviderAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReasonCode: string | null;
  /** 是否已登记私密履约信息（地址等；内容绝不在本视图出现） */
  hasPrivateDetails: boolean;
  visits?: (VisitView & { evidence?: EvidenceView[] })[];
  createdAt: string;
}

export interface ReviewView {
  id: string;
  targetType: string;
  targetId: string;
  role: string;
  rating: number;
  tags: string[];
  content: string | null;
  status: string;
  reviewer: PublicUserBrief;
  reviewee: PublicUserBrief;
  createdAt: string;
}

export const SAFETY_TIPS = [
  '服务者开始服务前请再次确认宠物照料注意事项与紧急联系方式。',
  '履约照片不要拍摄门牌、证件或家庭私人物品。',
  '平台不提供资金托管，请勿向陌生人预先支付押金/保证金。',
];

/** bigint 分 → number 分（金额范围远小于 2^53，转换安全） */
export function toMinor(value: bigint | null | undefined): number | null {
  return value === null || value === undefined ? null : Number(value);
}

export function toUserBrief(user: Pick<User, 'id' | 'nickname' | 'avatarUrl'>): PublicUserBrief {
  return { id: user.id, nickname: user.nickname, avatarUrl: user.avatarUrl };
}

export function toAvailabilityView(a: CareOfferingAvailability): AvailabilityView {
  return {
    id: a.id,
    startAt: a.startAt.toISOString(),
    endAt: a.endAt.toISOString(),
    capacity: a.capacity,
    status: a.status,
  };
}

export function toOfferingSummary(
  o: CareOffering & { provider: User },
  trust: TrustSummary,
): OfferingSummaryView {
  return {
    id: o.id,
    serviceType: o.serviceType,
    title: o.title,
    description: o.description,
    areaCode: o.areaCode,
    radiusKm: o.radiusKm,
    pricingType: o.pricingType,
    priceMinor: toMinor(o.priceMinor),
    cancelRule: o.cancelRule,
    status: o.status,
    provider: toUserBrief(o.provider),
    trust,
    createdAt: o.createdAt.toISOString(),
  };
}

export function toOfferingDetail(
  o: CareOffering & { provider: User; availabilities: CareOfferingAvailability[] },
  trust: TrustSummary,
  isOwner: boolean,
): OfferingDetailView {
  return {
    ...toOfferingSummary(o, trust),
    availabilities: o.availabilities.map(toAvailabilityView),
    isOwner,
    safetyTips: SAFETY_TIPS,
  };
}

export function toRequestView(
  r: CareRequest,
  requester: User,
  pets: PetBriefView[],
  isOwner: boolean,
): RequestView {
  return {
    id: r.id,
    serviceType: r.serviceType,
    title: r.title,
    description: r.description,
    areaCode: r.areaCode,
    startAt: r.startAt.toISOString(),
    endAt: r.endAt.toISOString(),
    frequency: r.frequency,
    pricingType: r.pricingType,
    priceMinor: toMinor(r.priceMinor),
    cancelRule: r.cancelRule,
    status: r.status,
    pets,
    requester: toUserBrief(requester),
    isOwner,
    createdAt: r.createdAt.toISOString(),
  };
}

export function toApplicationView(a: CareApplication, applicant: User): ApplicationView {
  return {
    id: a.id,
    requestId: a.requestId,
    applicant: toUserBrief(applicant),
    message: a.message,
    proposedPriceMinor: toMinor(a.proposedPriceMinor),
    status: a.status,
    decidedAt: a.decidedAt?.toISOString() ?? null,
    careOrderId: a.careOrderId,
    createdAt: a.createdAt.toISOString(),
  };
}

export function toVisitView(v: CareVisit): VisitView {
  return {
    id: v.id,
    seq: v.seq,
    scheduledAt: v.scheduledAt.toISOString(),
    startedAt: v.startedAt?.toISOString() ?? null,
    completedAt: v.completedAt?.toISOString() ?? null,
    status: v.status,
    notes: v.notes,
  };
}

export function toEvidenceView(e: {
  id: string;
  evidenceType: string;
  mediaAssetId: string | null;
  note: string | null;
  createdAt: Date;
}): EvidenceView {
  return {
    id: e.id,
    evidenceType: e.evidenceType,
    mediaAssetId: e.mediaAssetId,
    note: e.note,
    createdAt: e.createdAt.toISOString(),
  };
}

export function toOrderView(
  order: CareOrder & { requester: User; provider: User },
  callerId: string,
  options: {
    hasPrivateDetails: boolean;
    visits?: (CareVisit & { evidence: { id: string; evidenceType: string; mediaAssetId: string | null; note: string | null; createdAt: Date }[] })[];
  },
): OrderView {
  const role: 'REQUESTER' | 'PROVIDER' = order.requesterUserId === callerId ? 'REQUESTER' : 'PROVIDER';
  return {
    id: order.id,
    orderNo: order.orderNo,
    status: order.status,
    role,
    pricingType: order.pricingType,
    priceMinor: toMinor(order.priceMinor),
    termsVersion: order.termsVersion,
    agreedTerms: order.agreedTermsJson,
    requester: toUserBrief(order.requester),
    provider: toUserBrief(order.provider),
    confirmedByRequesterAt: order.confirmedByRequesterAt?.toISOString() ?? null,
    confirmedByProviderAt: order.confirmedByProviderAt?.toISOString() ?? null,
    completedAt: order.completedAt?.toISOString() ?? null,
    cancelledAt: order.cancelledAt?.toISOString() ?? null,
    cancelReasonCode: order.cancelReasonCode,
    hasPrivateDetails: options.hasPrivateDetails,
    ...(options.visits
      ? {
          visits: options.visits.map((v) => ({
            ...toVisitView(v),
            evidence: v.evidence.map(toEvidenceView),
          })),
        }
      : {}),
    createdAt: order.createdAt.toISOString(),
  };
}

export function toReviewView(
  review: {
    id: string;
    targetType: string;
    targetId: string;
    role: string;
    rating: number;
    tags: string[];
    content: string | null;
    status: string;
    createdAt: Date;
  },
  reviewer: User,
  reviewee: User,
): ReviewView {
  return {
    id: review.id,
    targetType: review.targetType,
    targetId: review.targetId,
    role: review.role,
    rating: review.rating,
    tags: review.tags,
    content: review.content,
    status: review.status,
    reviewer: toUserBrief(reviewer),
    reviewee: toUserBrief(reviewee),
    createdAt: review.createdAt.toISOString(),
  };
}
