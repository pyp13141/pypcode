import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { Public } from '../../../../common/decorators/public.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { CommunitySharedService } from '../../community-shared.service';
import { CommentView, PostView, toPostView } from '../../community-view';

/**
 * GET /api/v1/community/posts/:id — 契约：docs/modules/community/post-by-id.md
 * 可见性：PUBLIC 公开；FOLLOWERS 关注者可见；PRIVATE 仅自己；待审/已删仅作者可见；其余 404。
 * 详情内联最近 100 条可见评论（评论两级扁平：parentId 指向一级评论）。
 */
@ApiTags('community')
@Controller('community/posts')
export class PostByIdController {
  constructor(@Inject(CommunitySharedService) private readonly shared: CommunitySharedService) {}

  @Get(':id')
  @Public()
  @ApiOperation({ summary: '帖子详情（含可见评论）' })
  @ApiOkResponse({ description: '{ post: PostView, comments: CommentView[], helpPostId: string|null }' })
  async get(
    @CurrentUser() auth: AuthUser | undefined,
    @Param('id') id: string,
  ): Promise<{ post: PostView; comments: CommentView[]; helpPostId: string | null }> {
    const payload = await this.shared.postDetailPayload(id, auth?.id);
    return {
      post: toPostView(payload.post, auth?.id, payload.counts, payload.flags),
      comments: payload.comments,
      helpPostId: payload.post.helpPost?.id ?? null,
    };
  }
}
