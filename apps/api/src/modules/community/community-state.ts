/**
 * community 模块枚举与策略（API §5/§5.6 + PRODUCT_DESIGN 5.3/6.7/7.4 + D-010/D-013）。
 */
export const POST_VISIBILITIES = ['PUBLIC', 'FOLLOWERS', 'PRIVATE'] as const;
export const POST_MODERATION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export const HELP_CATEGORIES = ['PET_CARE', 'NEIGHBOR'] as const;
export const HELP_STATUSES = ['OPEN', 'RESOLVED', 'CLOSED', 'EXPIRED'] as const;

/** 机审辅助：命中高风险关键词 → 转人工审核（产品 5.3「内容检查」；不做自动判定，仅路由） */
export const RISK_KEYWORDS = [
  '加微信', '加v', '加V', '私聊', '转账', '打款', '押金', '保证金', '红包', '刷单', '代购', '返利', '扫码进群',
];

/** 频率限制（API 约束） */
export const POST_HOURLY_LIMIT = 10;
export const HELP_POST_DAILY_LIMIT = 5;
export const MESSAGE_PER_MINUTE_LIMIT = 10;
/** 新账号（24h 内）发帖进人工审核（产品 5.3「新账号…可降权或进入人工审核」） */
export const NEW_ACCOUNT_HOURS = 24;

export function riskKeywordsHit(text: string): string[] {
  const lower = text.toLowerCase();
  return RISK_KEYWORDS.filter((kw) => lower.includes(kw.toLowerCase()));
}

/** 榜单计算规则（产品 12.3：规则须在页面内可解释；不售卖排名） */
export const LEADERBOARD_RULES = {
  contribution: '按经确认完成的互助订单数排序（同分看评价样本量）；不售卖排名，无付费加权',
  content: '有效互动加权（收藏×3 + 点赞×2 + 评论×2），扣除已删除/隐藏内容；不含付费推广',
  growth: '近 30 天健康/情绪记录条数（记录持续性）；不按体重、健康状况或外貌评判宠物价值',
} as const;
