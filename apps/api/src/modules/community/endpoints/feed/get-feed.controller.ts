import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { Public } from '../../../../common/decorators/public.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { Paginated } from '../../../../common/pagination';
import { PostView } from '../../community-view';
import { FeedService } from './feed.service';

class FeedParams {
  @IsOptional() @IsIn(['recommended', 'following', 'latest']) tab?: string;
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() pageSize?: string;
}

/**
 * GET /api/v1/community/feed — 契约：docs/modules/community/feed.md
 * 公开可浏览前 N 条；被屏蔽/隐藏/删除内容不出现在任何人的流。
 */
@ApiTags('community')
@Controller('community/feed')
export class FeedController {
  constructor(@Inject(FeedService) private readonly service: FeedService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: '社区信息流（recommended|following|latest；following 需登录）' })
  @ApiOkResponse({ description: '分页：data 为 PostView[]' })
  async feed(@CurrentUser() auth: AuthUser | undefined, @Query() query: FeedParams): Promise<Paginated<PostView>> {
    return this.service.feed(query.tab, query.page, query.pageSize, auth?.id);
  }
}
