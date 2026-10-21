import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../../../../common/error-codes';
import { PrismaService } from '../../../../prisma/prisma.service';
import { NotificationsService } from '../../../notifications/notifications.service';
import { CommunitySharedService } from '../../community-shared.service';
import { CommentView, toCommentView } from '../../community-view';

export interface CreateCommentInput {
  content: string;
  parentId?: string;
}

/**
 * POST /api/v1/community/posts/:id/comments — 契约：docs/modules/community/post-comments.md
 * 两级回复：parentId 必须指向本帖子的一级评论（禁止三级）；通知帖主/被回复人。
 */
@Injectable()
export class PostCommentsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CommunitySharedService) private readonly shared: CommunitySharedService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  async create(postId: string, userId: string, input: CreateCommentInput): Promise<CommentView> {
    const post = await this.shared.requireVisiblePost(postId, userId);
    let parent: { id: string; parentId: string | null; authorUserId: string } | null = null;
    if (input.parentId) {
      parent = await this.prisma.comment.findFirst({
        where: { id: input.parentId, postId, status: 'VISIBLE' },
        select: { id: true, parentId: true, authorUserId: true },
      });
      if (!parent) {
        throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: '被回复的评论不存在' });
      }
      if (parent.parentId !== null) {
        throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: '仅支持两级回复（不能回复二级评论）' });
      }
    }
    const comment = await this.prisma.comment.create({
      data: { postId, authorUserId: userId, parentId: input.parentId ?? null, content: input.content },
      include: { author: true },
    });
    if (post.authorUserId !== userId) {
      await this.notifications.push(post.authorUserId, 'POST_COMMENTED', { postId, commentId: comment.id });
    }
    if (parent && parent.authorUserId !== userId && parent.authorUserId !== post.authorUserId) {
      await this.notifications.push(parent.authorUserId, 'COMMENT_REPLIED', { postId, commentId: comment.id });
    }
    return toCommentView(comment, userId);
  }
}
