/**
 * care 模块状态机与枚举（权威：docs/STATE_MACHINES.md + PRODUCT_DESIGN 11 节 + DECISIONS D-011）。
 * 规则：状态只能由领域服务在事务中变更并写 *_events；前端直写的 status 字段一律忽略。
 */

export const SERVICE_TYPES = ['FEED', 'WALK', 'BOARD', 'OTHER'] as const;
export const PRICING_TYPES = ['FREE', 'FIXED', 'NEGOTIABLE', 'BARTER'] as const;
/** D-011：cancelRule 语义收敛（FREE=立即生效；MUTUAL=需对方同意） */
export const CANCEL_RULES = ['FREE', 'MUTUAL'] as const;

export const OFFERING_STATUSES = ['DRAFT', 'PUBLISHED', 'PAUSED', 'ARCHIVED', 'REMOVED'] as const;
export const REQUEST_STATUSES = ['DRAFT', 'PUBLISHED', 'MATCHED', 'CANCELLED', 'EXPIRED'] as const;
export const APPLICATION_STATUSES = ['PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED'] as const;

export const ORDER_STATUSES = [
  'PENDING_CONFIRMATION',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETION_SUBMITTED',
  'COMPLETED',
  'CANCEL_REQUESTED',
  'CANCELLED',
  'DISPUTED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const VISIT_STATUSES = [
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETION_SUBMITTED',
  'COMPLETED',
  'MISSED',
  'CANCELLED',
  'EXCEPTION',
] as const;

export const ORDER_TERMINAL_STATUSES: readonly OrderStatus[] = ['COMPLETED', 'CANCELLED'];

/** 公告状态允许的流转（STATE_MACHINES §1；REMOVED 仅审核路径，客户端不可达） */
export const OFFERING_TRANSITIONS: Record<string, readonly string[]> = {
  DRAFT: ['PUBLISHED', 'ARCHIVED'],
  PUBLISHED: ['PAUSED', 'ARCHIVED'],
  PAUSED: ['PUBLISHED', 'ARCHIVED'],
  ARCHIVED: [],
  REMOVED: [],
};

/** 订单状态机允许的转换（STATE_MACHINES §4；CANCEL_REQUESTED→DISPUTED 为取消协商卡死的逃生阀，D-011） */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING_CONFIRMATION: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['IN_PROGRESS', 'CANCEL_REQUESTED', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETION_SUBMITTED', 'CANCEL_REQUESTED', 'DISPUTED'],
  COMPLETION_SUBMITTED: ['COMPLETED', 'DISPUTED', 'CANCEL_REQUESTED'],
  CANCEL_REQUESTED: ['CANCELLED', 'DISPUTED'],
  COMPLETED: [],
  CANCELLED: [],
  DISPUTED: [],
};

/** 允许发起纠纷工单的订单状态（STATE_MACHINES §4 + D-011） */
export const DISPUTE_OPENABLE_STATUSES = ['IN_PROGRESS', 'COMPLETION_SUBMITTED', 'CANCEL_REQUESTED'] as const;

export function canTransition(from: string, to: string): boolean {
  const allowed = ORDER_TRANSITIONS[from as OrderStatus];
  return Array.isArray(allowed) && allowed.includes(to);
}

/** 私密地址可读的订单状态（API §3 private-details；也是条款快照里的地址访问规则） */
export const PRIVATE_DETAILS_READABLE_STATUSES = ['CONFIRMED', 'IN_PROGRESS', 'COMPLETION_SUBMITTED'] as const;
/** 私密地址可写的订单状态（D-011：确认前后到服务完成前可由需求方更新） */
export const PRIVATE_DETAILS_WRITABLE_STATUSES = ['PENDING_CONFIRMATION', 'CONFIRMED'] as const;

/** 单次上门允许的流转（STATE_MACHINES §5；D-011：COMPLETION_SUBMITTED 预留） */
export const VISIT_TRANSITIONS: Record<string, readonly string[]> = {
  SCHEDULED: ['IN_PROGRESS', 'COMPLETED', 'MISSED', 'CANCELLED', 'EXCEPTION'],
  IN_PROGRESS: ['COMPLETED', 'EXCEPTION', 'MISSED'],
  COMPLETION_SUBMITTED: ['COMPLETED', 'EXCEPTION'],
  COMPLETED: [],
  MISSED: [],
  CANCELLED: [],
  EXCEPTION: [],
};

/** 提交整体完成时允许的 visit 终态（EXCEPTION/MISSED/CANCELLED 需有说明） */
export const VISIT_OK_FOR_ORDER_COMPLETION = ['COMPLETED', 'EXCEPTION', 'MISSED', 'CANCELLED'] as const;

export const DISPUTE_REASON_CODES = [
  'PET_CONDITION',
  'NO_SHOW',
  'CANNOT_ACCESS',
  'UNREACHABLE',
  'DAMAGE',
  'OTHER',
] as const;

/** 取消原因码（写 care_orders.cancel_reason_code 与订单事件） */
export const CANCEL_REASON_CODES = [
  'REQUESTER_CHANGED_PLAN',
  'PROVIDER_UNAVAILABLE',
  'SCHEDULE_CONFLICT',
  'NO_RESPONSE',
  'PET_UNWELL',
  'OTHER',
] as const;

/** 未决纠纷（决定评价是否暂缓公开展示） */
export const DISPUTE_UNRESOLVED_STATUSES = ['OPEN', 'EVIDENCE', 'PENDING_RULING', 'APPEALING'] as const;

export const TERMS_VERSION = 'v1';

/**
 * 发布门槛运营开关（D-011 / D-014）：开启后要求"联系人已验证"——
 * 手机号已验证 **或** 邮箱已验证（首期以邮箱验证码为准，D-014 用邮箱替代手机号）。
 */
export function requireContactVerified(): boolean {
  return process.env.CARE_REQUIRE_PHONE_VERIFIED === 'true';
}

/** 服务者开始服务的时间窗（小时，API §3 start：±24h 可配） */
export function startWindowHours(): number {
  const raw = Number(process.env.CARE_START_WINDOW_HOURS ?? 24);
  return Number.isFinite(raw) && raw > 0 ? raw : 24;
}

/** 定价类型与金额组合一致性（与迁移里的 CHECK 对应，先应用层拦截给清晰 message） */
export function validatePricing(pricingType: string, priceMinor: number | null | undefined): string | null {
  if (pricingType === 'FIXED' && (priceMinor === null || priceMinor === undefined)) {
    return 'FIXED 定价类型必须提供 priceMinor（整数分）';
  }
  if (pricingType === 'FREE' && priceMinor !== null && priceMinor !== undefined && priceMinor !== 0) {
    return 'FREE 定价类型不能设置价格（priceMinor 需为空或 0）';
  }
  if (priceMinor !== null && priceMinor !== undefined && (!Number.isInteger(priceMinor) || priceMinor < 0)) {
    return 'priceMinor 必须为不小于 0 的整数分';
  }
  return null;
}

/** 可用时段合法性：end > start、容量 1-99、时段条数上限 */
export function validateAvailabilities(
  availabilities: { startAt: string; endAt: string; capacity?: number }[],
): string | null {
  if (availabilities.length > 50) return '可用时段最多 50 条';
  for (const [i, slot] of availabilities.entries()) {
    const start = new Date(slot.startAt);
    const end = new Date(slot.endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return `第 ${i + 1} 条时段时间格式不正确`;
    if (end <= start) return `第 ${i + 1} 条时段 endAt 必须晚于 startAt`;
    const capacity = slot.capacity ?? 1;
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 99) return `第 ${i + 1} 条时段 capacity 需为 1-99`;
  }
  return null;
}
