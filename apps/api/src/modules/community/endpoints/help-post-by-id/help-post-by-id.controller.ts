import { Controller, Get, Inject, NotFoundException, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { Public } from '../../../../common/decorators/public.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { ERROR_CODES } from '../../../../common/error-codes';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CommunitySharedService } from '../../community-shared.service';
import { CommentView, HelpPostView, toHelpPostView } from '../../community-view';

/**
 * GET /api/v1/community/help-posts/:id — 契约：docs/modules/community/help-post-by-id.md
 * 详情 + 评论区（评论复用帖子的评论能力：发评论走 POST /community/posts/:postId/comments）。
 */
@ApiTags('community')
@Controller('community/help-posts')
export class HelpPostByIdController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CommunitySharedService) private readonly shared: CommunitySharedService,
  ) {}

  @Get(':id')
  @Public()
  @ApiOperation({ summary: '求助帖详情（含评论）' })
  @ApiOkResponse({ description: '{ helpPost: HelpPostView, comments: CommentView[] }' })
  async get(
    @CurrentUser() auth: AuthUser | undefined,
    @Param('id') id: string,
  ): Promise<{ helpPost: HelpPostView; comments: CommentView[] }> {
    const row = await this.prisma.helpPost.findUnique({
      where: { id },
      include: { author: true, post: { select: { content: true, moderationStatus: true, authorUserId: true } } },
    });
    if (!row) {
      throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '求助帖不存在' });
    }
    const payload = await this.shared.postDetailPayload(row.postId, auth?.id);
    const commentCount = payload.comments.length;
    return {
      helpPost: toHelpPostView(row, row.post.content, commentCount, auth?.id),
      comments: payload.comments,
    };
  }
}
