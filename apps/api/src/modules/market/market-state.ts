/**
 * market 模块状态机与枚举（权威：docs/STATE_MACHINES.md §6 + PRODUCT_DESIGN 11.5 + ERD §3）。
 * 列表公告状态与交易状态分离；状态只能经领域服务在事务中变更并写 market_deal_events。
 */
export const LISTING_TYPES = ['GIFT', 'SWAP', 'SALE', 'WANTED'] as const;
export const LISTING_CONDITIONS = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR'] as const;
export const LISTING_STATUSES = ['DRAFT', 'PUBLISHED', 'PENDING_REVIEW', 'SOLD', 'REMOVED', 'EXPIRED'] as const;
export const DEAL_STATUSES = [
  'CONTACTED',
  'AGREEMENT_PENDING',
  'AGREED',
  'HANDED_OVER',
  'COMPLETED',
  'CANCELLED',
  'DISPUTED',
] as const;
export type DealStatus = (typeof DEAL_STATUSES)[number];

/** 列表公告允许的状态流转（用户可触达；REMOVED 仅审核路径） */
export const LISTING_TRANSITIONS: Record<string, readonly string[]> = {
  DRAFT: ['PUBLISHED', 'PENDING_REVIEW', 'EXPIRED'],
  PUBLISHED: ['EXPIRED', 'SOLD'],
  PENDING_REVIEW: ['EXPIRED'],
  SOLD: [],
  REMOVED: [],
  EXPIRED: [],
};

/** 交易状态机（STATE_MACHINES §6：CONTACTED → AGREEMENT_PENDING → AGREED → HANDED_OVER → COMPLETED） */
export const DEAL_TRANSITIONS: Record<DealStatus, readonly DealStatus[]> = {
  CONTACTED: ['AGREEMENT_PENDING', 'AGREED', 'CANCELLED'],
  AGREEMENT_PENDING: ['AGREED', 'CANCELLED'],
  AGREED: ['HANDED_OVER', 'CANCELLED', 'DISPUTED'],
  HANDED_OVER: ['COMPLETED', 'DISPUTED'],
  COMPLETED: [],
  CANCELLED: [],
  DISPUTED: [],
};

/** 进行中交易（一物一单约束范围：同意交接后不允许跨买家并行，D-012） */
export const DEAL_ACTIVE_STATUSES: readonly string[] = ['AGREEMENT_PENDING', 'AGREED', 'HANDED_OVER'];
/** 交易可取消的状态 */
export const DEAL_CANCELLABLE_STATUSES: readonly string[] = ['CONTACTED', 'AGREEMENT_PENDING', 'AGREED'];
/** 交易可发起纠纷的状态 */
export const DEAL_DISPUTABLE_STATUSES: readonly string[] = ['AGREEMENT_PENDING', 'AGREED', 'HANDED_OVER'];

export function canDealTransition(from: string, to: string): boolean {
  const allowed = DEAL_TRANSITIONS[from as DealStatus];
  return Array.isArray(allowed) && allowed.includes(to);
}

/** 价格与交易类型一致性（与迁移 CHECK 对应） */
export function validateListingPrice(listingType: string, priceMinor: number | null | undefined): string | null {
  const price = priceMinor ?? null;
  if (price !== null && (!Number.isInteger(price) || price < 0)) return 'priceMinor 必须为不小于 0 的整数分';
  if (listingType === 'SALE' && (price === null || price <= 0)) return 'SALE 出售必须提供大于 0 的 priceMinor';
  if (listingType === 'GIFT' && price !== null && price !== 0) return 'GIFT 赠送不能设置价格';
  if ((listingType === 'SWAP' || listingType === 'WANTED') && price !== null && price < 0) return 'priceMinor 不能为负';
  return null;
}

export const DEAL_CANCEL_REASON_CODES = [
  'BUYER_CHANGED_MIND',
  'SELLER_CHANGED_MIND',
  'SCHEDULE_CONFLICT',
  'ITEM_NOT_AS_DESCRIBED',
  'LISTING_SOLD',
  'NO_RESPONSE',
  'OTHER',
] as const;

export const MARKET_DISPUTE_REASON_CODES = [
  'ITEM_NOT_AS_DESCRIBED',
  'NO_SHOW',
  'DAMAGE',
  'FRAUD_SUSPECTED',
  'PROHIBITED_ITEM',
  'OTHER',
] as const;

/** 详情页安全提示（产品 5.2 / 7.3：线下交接提示） */
export const MARKET_SAFETY_TIPS = [
  '建议在公共场所交接，先检查物品数量与状态再完成确认。',
  '平台不提供资金托管，请勿预先支付押金/保证金或向陌生人私下转账。',
  '交接完成不等于平台验证了物品真实情况，请自行核验。',
];
