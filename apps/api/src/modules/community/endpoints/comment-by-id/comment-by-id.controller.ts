import { Body, Controller, Delete, Inject, Param, Patch } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { CommentView } from '../../community-view';
import { CommentByIdService } from './comment-by-id.service';

class PatchCommentDto {
  @IsString() @Length(1, 500) content!: string;
}

/** PATCH/DELETE /api/v1/community/comments/:id — 契约：docs/modules/community/comment-by-id.md */
@ApiTags('community')
@Controller('community/comments')
export class CommentByIdController {
  constructor(@Inject(CommentByIdService) private readonly service: CommentByIdService) {}

  @Patch(':id')
  @ApiOperation({ summary: '编辑本人评论' })
  @ApiOkResponse({ description: 'CommentView' })
  async patch(@CurrentUser() auth: AuthUser, @Param('id') id: string, @Body() dto: PatchCommentDto): Promise<CommentView> {
    return this.service.patch(id, auth.id, dto.content);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除本人评论（软删）' })
  async remove(@CurrentUser() auth: AuthUser, @Param('id') id: string): Promise<{ deleted: true }> {
    return this.service.remove(id, auth.id);
  }
}
