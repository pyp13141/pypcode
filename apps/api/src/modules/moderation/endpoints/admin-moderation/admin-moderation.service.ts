import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ERROR_CODES } from '../../../../common/error-codes';
import { PrismaService } from '../../../../prisma/prisma.service';
import { NotificationsService } from '../../../notifications/notifications.service';
import { AdminAuditService } from '../../admin-audit.service';

/** GET /admin/moderation/queue + POST /admin/moderation/:id/decision — 契约：docs/modules/report-admin/admin-moderation.md */
@Injectable()
export class AdminModerationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AdminAuditService) private readonly audit: AdminAuditService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  async queue(type: string | undefined, pageRaw?: string, pageSizeRaw?: string) {
    const page = Math.max(1, Math.floor(Number(pageRaw ?? 1)) || 1);
    const pageSize = Math.min(50, Math.max(1, Math.floor(Number(pageSizeRaw ?? 20)) || 20));
    const skip = (page - 1) * pageSize;
    const wantPosts = !type || type === 'POST';
    const wantListings = !type || type === 'LISTING';
    if (!wantPosts && !wantListings) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: 'type 需为 POST/LISTING' });
    }
    const [posts, postTotal, listings, listingTotal] = await Promise.all([
      wantPosts
        ? this.prisma.post.findMany({
            where: { moderationStatus: 'PENDING', deletedAt: null },
            include: { author: { select: { id: true, nickname: true } }, media: { select: { mediaAssetId: true } } },
            orderBy: { createdAt: 'asc' },
            skip,
            take: pageSize,
          })
        : [],
      wantPosts ? this.prisma.post.count({ where: { moderationStatus: 'PENDING', deletedAt: null } }) : 0,
      wantListings
        ? this.prisma.marketListing.findMany({
            where: { status: 'PENDING_REVIEW' },
            include: { seller: { select: { id: true, nickname: true } }, category: { select: { code: true, name: true, riskLevel: true } } },
            orderBy: { createdAt: 'asc' },
            skip,
            take: pageSize,
          })
        : [],
      wantListings ? this.prisma.marketListing.count({ where: { status: 'PENDING_REVIEW' } }) : 0,
    ]);
    return {
      posts: posts.map((p) => ({
        id: p.id,
        content: p.content,
        author: p.author,
        imageMediaIds: p.media.map((m) => m.mediaAssetId),
        createdAt: p.createdAt.toISOString(),
      })),
      postTotal,
      listings: listings.map((l) => ({
        id: l.id,
        title: l.title,
        description: l.description,
        seller: l.seller,
        category: l.category,
        priceMinor: l.priceMinor === null ? null : Number(l.priceMinor),
        createdAt: l.createdAt.toISOString(),
      })),
      listingTotal,
    };
  }

  async decide(adminUserId: string, targetId: string, targetType: string, decision: string, reason: string, requestId?: string) {
    if (!['POST', 'LISTING'].includes(targetType)) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: 'targetType 需为 POST/LISTING' });
    }
    if (!['APPROVE', 'REMOVE'].includes(decision)) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: 'decision 需为 APPROVE/REMOVE' });
    }
    let result: { id: string; status: string; authorUserId?: string } = { id: targetId, status: '' };
    if (targetType === 'POST') {
      const post = await this.prisma.post.findUnique({ where: { id: targetId }, select: { id: true, authorUserId: true, moderationStatus: true } });
      if (!post) throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '内容不存在' });
      const updated = await this.prisma.post.update({
        where: { id: targetId },
        data: {
          moderationStatus: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
          ...(decision === 'REMOVE' ? { hiddenAt: new Date() } : {}),
        },
        select: { id: true, moderationStatus: true },
      });
      result = { id: updated.id, status: updated.moderationStatus, authorUserId: post.authorUserId };
      await this.notifications.push(post.authorUserId, decision === 'APPROVE' ? 'CONTENT_APPROVED' : 'CONTENT_REMOVED', { postId: targetId, reason });
    } else {
      const listing = await this.prisma.marketListing.findUnique({ where: { id: targetId }, select: { id: true, sellerUserId: true, status: true } });
      if (!listing) throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '列表不存在' });
      const updated = await this.prisma.marketListing.update({
        where: { id: targetId },
        data: decision === 'APPROVE'
          ? { status: 'PUBLISHED' }
          : { status: 'REMOVED', removedReason: reason },
        select: { id: true, status: true },
      });
      result = { id: updated.id, status: updated.status, authorUserId: listing.sellerUserId };
      await this.notifications.push(listing.sellerUserId, decision === 'APPROVE' ? 'LISTING_APPROVED' : 'LISTING_REMOVED', { listingId: targetId, reason });
    }
    await this.prisma.moderationAction.create({
      data: { targetType, targetId, action: decision, reason, adminId: adminUserId },
    });
    await this.audit.record({
      adminUserId,
      action: `MODERATION_${decision}`,
      resourceType: targetType,
      resourceId: targetId,
      requestId,
      reason,
    });
    return result;
  }
}
