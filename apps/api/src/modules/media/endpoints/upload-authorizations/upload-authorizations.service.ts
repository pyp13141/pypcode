import { BadRequestException, HttpException, Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { ERROR_CODES } from '../../../../common/error-codes';
import { PrismaService } from '../../../../prisma/prisma.service';
import { MEDIA_HOURLY_LIMIT, MEDIA_PURPOSE_POLICY, isMediaPurpose } from '../../media-state';
import { signScopedToken } from '../../../../common/crypto/sensitive-crypto';

export interface UploadAuthorization {
  mediaId: string;
  /** 相对 API 根路径的直传地址（客户端拼自己的 baseURL） */
  uploadPath: string;
  /** 配置了 PUBLIC_API_ORIGIN 时给绝对地址 */
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAt: string;
}

/**
 * POST /api/v1/media/upload-authorizations — 契约：docs/modules/media/upload-authorizations.md
 * 服务端按 purpose 下发 MIME 白名单/大小上限与短时签名直传地址；频控 20 次/小时/人。
 */
@Injectable()
export class UploadAuthorizationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async authorize(userId: string, purpose: string, count: number): Promise<UploadAuthorization[]> {
    if (!isMediaPurpose(purpose)) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: 'purpose 不合法' });
    }
    const policy = MEDIA_PURPOSE_POLICY[purpose];
    if (!Number.isInteger(count) || count < 1 || count > policy.maxCount) {
      throw new BadRequestException({
        code: ERROR_CODES.REQUEST_VALIDATION_FAILED,
        message: `count 需为 1-${policy.maxCount}`,
      });
    }
    const hourAgo = new Date(Date.now() - 3600_000);
    const recent = await this.prisma.mediaAsset.count({
      where: { ownerUserId: userId, createdAt: { gte: hourAgo } },
    });
    if (recent + count > MEDIA_HOURLY_LIMIT) {
      throw new HttpException({ code: ERROR_CODES.RATE_LIMITED, message: '上传授权过于频繁（20 次/小时）' }, 429);
    }

    const origin = (process.env.PUBLIC_API_ORIGIN ?? '').replace(/\/$/, '');
    const expiresAtMs = Date.now() + policy.uploadTtlSeconds * 1000;
    const uploads: UploadAuthorization[] = [];
    for (let i = 0; i < count; i += 1) {
      const objectKey = randomBytes(16).toString('hex');
      const media = await this.prisma.mediaAsset.create({
        data: {
          ownerUserId: userId,
          objectKey,
          purpose,
          uploadExpiresAt: new Date(expiresAtMs),
          moderationStatus: 'PENDING',
        },
      });
      const token = signScopedToken('media', media.id, 'upload', expiresAtMs);
      const uploadPath = `/api/v1/media/${media.id}/upload?expires=${expiresAtMs}&token=${token}`;
      uploads.push({
        mediaId: media.id,
        uploadPath,
        uploadUrl: origin ? `${origin}${uploadPath}` : uploadPath,
        headers: { 'Content-Type': 'application/octet-stream' },
        expiresAt: new Date(expiresAtMs).toISOString(),
      });
    }
    return uploads;
  }
}
