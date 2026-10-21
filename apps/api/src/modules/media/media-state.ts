/**
 * 媒体管线枚举与策略（API §5 媒体端点；D-007 本地盘适配器先行）。
 * 服务端按 purpose 下发 MIME 白名单与大小上限，客户端不得自定。
 */
export const MEDIA_PURPOSES = ['PET_AVATAR', 'POST_IMAGE', 'LISTING_IMAGE', 'EVIDENCE'] as const;
export type MediaPurpose = (typeof MEDIA_PURPOSES)[number];

export interface MediaPurposePolicy {
  mimeWhitelist: string[];
  maxBytes: number;
  /** 单次授权最大数量 */
  maxCount: number;
  /** 授权有效期（秒） */
  uploadTtlSeconds: number;
}

const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];

export const MEDIA_PURPOSE_POLICY: Record<MediaPurpose, MediaPurposePolicy> = {
  PET_AVATAR: { mimeWhitelist: IMAGE_MIME, maxBytes: 2 * 1024 * 1024, maxCount: 1, uploadTtlSeconds: 600 },
  POST_IMAGE: { mimeWhitelist: IMAGE_MIME, maxBytes: 5 * 1024 * 1024, maxCount: 9, uploadTtlSeconds: 600 },
  LISTING_IMAGE: { mimeWhitelist: IMAGE_MIME, maxBytes: 5 * 1024 * 1024, maxCount: 9, uploadTtlSeconds: 600 },
  EVIDENCE: { mimeWhitelist: IMAGE_MIME, maxBytes: 5 * 1024 * 1024, maxCount: 9, uploadTtlSeconds: 600 },
};

/** 读取签名 URL 有效期（秒） */
export const MEDIA_READ_TTL_SECONDS = 300;
/** 授权频控：每小时每人最大授权次数（API §5：如 20 次/小时/人） */
export const MEDIA_HOURLY_LIMIT = 20;

export function isMediaPurpose(value: string): value is MediaPurpose {
  return (MEDIA_PURPOSES as readonly string[]).includes(value);
}

export const MEDIA_MODERATION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
