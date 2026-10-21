import { Body, Controller, Inject, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { CommentView } from '../../community-view';
import { PostCommentsService } from './post-comments.service';

class CreateCommentDto {
  @IsString() @Length(1, 500) content!: string;
  @IsOptional() @IsUUID('4') parentId?: string;
}

/** POST /api/v1/community/posts/:id/comments — 契约：docs/modules/community/post-comments.md */
@ApiTags('community')
@Controller('community/posts')
export class PostCommentsController {
  constructor(@Inject(PostCommentsService) private readonly service: PostCommentsService) {}

  @Post(':id/comments')
  @ApiOperation({ summary: '发表评论/回复（两级）' })
  @ApiOkResponse({ description: 'CommentView' })
  async create(@CurrentUser() auth: AuthUser, @Param('id') postId: string, @Body() dto: CreateCommentDto): Promise<CommentView> {
    return this.service.create(postId, auth.id, dto);
  }
}
