import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ERROR_CODES } from '../../../../common/error-codes';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CommentView, toCommentView } from '../../community-view';

/**
 * PATCH/DELETE /api/v1/community/comments/:id — 契约：docs/modules/community/comment-by-id.md
 * 仅作者本人；删除为软删（status=DELETED + deleted_at，审计保留）。
 */
@Injectable()
export class CommentByIdService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async patch(commentId: string, userId: string, content: string): Promise<CommentView> {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, authorUserId: userId, status: 'VISIBLE' },
      include: { author: true },
    });
    if (!comment) {
      throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '评论不存在' });
    }
    const updated = await this.prisma.comment.update({ where: { id: commentId }, data: { content }, include: { author: true } });
    return toCommentView(updated, userId);
  }

  async remove(commentId: string, userId: string): Promise<{ deleted: true }> {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, authorUserId: userId, status: 'VISIBLE' },
      select: { id: true },
    });
    if (!comment) {
      throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '评论不存在' });
    }
    await this.prisma.comment.update({ where: { id: commentId }, data: { status: 'DELETED', deletedAt: new Date() } });
    return { deleted: true };
  }
}
