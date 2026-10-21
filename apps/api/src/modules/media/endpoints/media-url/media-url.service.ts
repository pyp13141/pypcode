import { HttpException, Inject, Injectable } from '@nestjs/common';
import { SensitiveAccessService } from '../../../../common/audit/sensitive-access.service';
import { signScopedToken } from '../../../../common/crypto/sensitive-crypto';
import { ERROR_CODES } from '../../../../common/error-codes';
import { PrismaService } from '../../../../prisma/prisma.service';
import { MEDIA_READ_TTL_SECONDS } from '../../media-state';

export interface MediaUrlView {
  mediaId: string;
  path: string;
  url: string;
  expiresAt: string;
}

/**
 * GET /api/v1/media/:mediaId/url — 契约：docs/modules/media/media-url.md
 * 读取 = 短时签名 URL + 业务授权校验（API §5）。
 * 授权规则：owner 恒可；PET_AVATAR 公开；LISTING_IMAGE 随列表公开；EVIDENCE 仅订单参与方（读取写审计）；
 * POST_IMAGE 公开可见性随 M4 帖子可见性（当前 owner-only）。REJECTED 一律 404。
 */
@Injectable()
export class MediaUrlService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SensitiveAccessService) private readonly audit: SensitiveAccessService,
  ) {}

  async issue(mediaId: string, viewerId?: string, requestId?: string): Promise<MediaUrlView> {
    const media = await this.prisma.mediaAsset.findUnique({ where: { id: mediaId } });
    if (!media || media.moderationStatus === 'REJECTED') {
      throw new HttpException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '媒体不存在' }, 404);
    }
    const isOwner = viewerId === media.ownerUserId;
    if (!isOwner) {
      await this.assertBusinessAccess(mediaId, media.purpose, viewerId, requestId);
    }

    const expiresAtMs = Date.now() + MEDIA_READ_TTL_SECONDS * 1000;
    const token = signScopedToken('media', mediaId, 'read', expiresAtMs);
    const path = `/api/v1/media/${mediaId}/file?expires=${expiresAtMs}&token=${token}`;
    const origin = (process.env.PUBLIC_API_ORIGIN ?? '').replace(/\/$/, '');
    return { mediaId, path, url: origin ? `${origin}${path}` : path, expiresAt: new Date(expiresAtMs).toISOString() };
  }

  private async assertBusinessAccess(mediaId: string, purpose: string, viewerId?: string, requestId?: string): Promise<void> {
    const deny = (): never => {
      throw new HttpException({ code: ERROR_CODES.RESOURCE_FORBIDDEN, message: '无权读取该媒体' }, 403);
    };
    switch (purpose) {
      case 'PET_AVATAR':
        return; // 公开
      case 'LISTING_IMAGE': {
        const link = await this.prisma.marketListingMedia.findFirst({
          where: { mediaAssetId: mediaId },
          include: { listing: { select: { status: true } } },
        });
        if (link && link.listing.status === 'PUBLISHED') return;
        return deny();
      }
      case 'POST_IMAGE':
        // 帖子可见性接入后放行（M4）；在此之前仅 owner 可读
        return deny();
      case 'EVIDENCE': {
        if (!viewerId) return deny();
        const evidence = await this.prisma.careEvidence.findFirst({
          where: { mediaAssetId: mediaId },
          include: { visit: { select: { careOrderId: true } } },
        });
        if (!evidence) return deny();
        const order = await this.prisma.careOrder.findUnique({
          where: { id: evidence.visit.careOrderId },
          select: { requesterUserId: true, providerUserId: true },
        });
        if (!order || (order.requesterUserId !== viewerId && order.providerUserId !== viewerId)) return deny();
        await this.audit.log({
          actorUserId: viewerId,
          resourceType: 'CARE_ORDER',
          resourceId: evidence.visit.careOrderId,
          fieldGroups: ['EVIDENCE'],
          purpose: 'CARE_EVIDENCE_READ',
          requestId,
        });
        return;
      }
      default:
        return deny();
    }
  }
}
