import { HttpException, Inject, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../../../../common/error-codes';
import { PrismaService } from '../../../../prisma/prisma.service';
import { MediaStorageService } from '../../media-storage.service';
import { MEDIA_PURPOSE_POLICY, isMediaPurpose } from '../../media-state';

export interface MediaFinalizeView {
  mediaId: string;
  purpose: string;
  mimeType: string | null;
  sizeBytes: number | null;
  moderationStatus: string;
  finalizedAt: string;
}

/**
 * POST /api/v1/media/:mediaId/finalize — 契约：docs/modules/media/media-finalize.md
 * 上传完成后登记大小/类型 → 审核态 PENDING（大小/类型由直传端点实测回填，服务端为准）。
 */
@Injectable()
export class MediaFinalizeService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MediaStorageService) private readonly storage: MediaStorageService,
  ) {}

  async finalize(mediaId: string, userId: string): Promise<MediaFinalizeView> {
    const media = await this.prisma.mediaAsset.findUnique({ where: { id: mediaId } });
    if (!media || media.ownerUserId !== userId) {
      throw new HttpException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '媒体不存在' }, 404);
    }
    if (media.finalizedAt) {
      return this.view(media);
    }
    const uploaded = await this.storage.exists(media.objectKey);
    if (!uploaded) {
      throw new HttpException({ code: ERROR_CODES.RESOURCE_CONFLICT, message: '尚未收到上传内容，请先完成直传' }, 409);
    }
    if (isMediaPurpose(media.purpose) && media.sizeBytes !== null && Number(media.sizeBytes) > MEDIA_PURPOSE_POLICY[media.purpose].maxBytes) {
      // 防御性兜底（直传端点已限制，此处防历史/异常数据）
      await this.storage.deleteObject(media.objectKey);
      throw new HttpException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: '文件超过大小上限' }, 400);
    }
    const updated = await this.prisma.mediaAsset.update({
      where: { id: mediaId },
      data: { finalizedAt: new Date(), moderationStatus: 'PENDING' },
    });
    return this.view(updated);
  }

  private view(media: {
    id: string;
    purpose: string;
    mimeType: string | null;
    sizeBytes: bigint | null;
    moderationStatus: string;
    finalizedAt: Date | null;
  }): MediaFinalizeView {
    return {
      mediaId: media.id,
      purpose: media.purpose,
      mimeType: media.mimeType,
      sizeBytes: media.sizeBytes === null ? null : Number(media.sizeBytes),
      moderationStatus: media.moderationStatus,
      finalizedAt: media.finalizedAt?.toISOString() ?? '',
    };
  }
}
