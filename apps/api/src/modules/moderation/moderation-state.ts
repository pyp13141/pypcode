/**
 * moderation 模块枚举（API §5/§6 + 产品 7.4/11.6）。
 */
export const REPORT_REASONS = ['SCAM', 'HARASSMENT', 'MISINFO', 'DANGEROUS', 'ANIMAL_ABUSE', 'PROHIBITED', 'IP', 'AD', 'OTHER'] as const;
export const REPORT_TARGET_TYPES = ['USER', 'POST', 'COMMENT', 'LISTING', 'OFFERING', 'REQUEST', 'DEAL', 'CONVERSATION', 'MESSAGE'] as const;
export const REPORT_STATUSES = ['NEW', 'PROCESSING', 'RESOLVED', 'DISMISSED', 'APPEALING', 'CLOSED'] as const;
/** 未决举报状态（重复举报合并范围） */
export const REPORT_OPEN_STATUSES = ['NEW', 'PROCESSING'] as const;

export const ADMIN_ROLE_CODES = ['content_moderator', 'support_operator', 'catalog_operator', 'analyst', 'super_admin'] as const;
export type AdminRoleCode = (typeof ADMIN_ROLE_CODES)[number];

/** 纠纷裁定结论（产品 5.1/5.2：争议结束后以审计事件记录结果，不伪造完成） */
export const DISPUTE_RESOLUTION_CODES = ['COMPLETED', 'CANCELLED', 'NO_FAULT'] as const;
export const DISPUTE_STATUSES = ['OPEN', 'EVIDENCE', 'PENDING_RULING', 'RULED', 'APPEALING', 'CLOSED'] as const;
