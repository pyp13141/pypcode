import { Body, Controller, Inject, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { PostView } from '../../community-view';
import { PostsService } from './posts.service';

class CreatePostDto {
  @IsString() @Length(1, 2000) content!: string;
  @IsOptional() @IsArray() @ArrayMaxSize(9) @IsUUID('4', { each: true }) images?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsString({ each: true }) @MaxLength(40, { each: true }) topicIds?: string[];
}

/** POST /api/v1/community/posts — 契约：docs/modules/community/posts.md */
@ApiTags('community')
@Controller('community/posts')
export class PostsController {
  constructor(@Inject(PostsService) private readonly service: PostsService) {}

  @Post()
  @ApiOperation({ summary: '发布图文（新号/风险关键词转人工审核；话题标签二期）' })
  @ApiOkResponse({ description: 'PostView' })
  async create(@CurrentUser() auth: AuthUser, @Body() dto: CreatePostDto): Promise<PostView> {
    return this.service.create(auth.id, dto);
  }
}
