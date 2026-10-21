import { Body, Controller, Get, Inject, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { Public } from '../../../../common/decorators/public.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { Paginated } from '../../../../common/pagination';
import { HELP_CATEGORIES, HELP_STATUSES } from '../../community-state';
import { HelpPostView } from '../../community-view';
import { HelpPostsService } from './help-posts.service';

class CreateHelpPostDto {
  // 白名单在服务层校验（错误码 HELP_CATEGORY_NOT_ALLOWED，契约要求）
  @IsString() @Length(2, 20) category!: string;
  @IsString() @Length(5, 50) title!: string;
  @IsString() @Length(1, 1000) content!: string;
  @IsOptional() @IsUUID('4') cityId?: string;
  @IsOptional() @IsUUID('4') stationId?: string;
  @IsOptional() @IsString() deadlineAt?: string;
}

class ListHelpPostsParams {
  @IsOptional() @IsIn(HELP_CATEGORIES as unknown as string[]) category?: string;
  @IsOptional() @IsUUID('4') cityId?: string;
  @IsOptional() @IsUUID('4') stationId?: string;
  @IsOptional() @IsIn(HELP_STATUSES as unknown as string[]) status?: string;
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() pageSize?: string;
}

/**
 * GET/POST /api/v1/community/help-posts — 契约：docs/modules/community/help-posts.md
 * D-010 轻量层：无订单机制；首期分类白名单 PET_CARE/NEIGHBOR。
 */
@ApiTags('community')
@Controller('community/help-posts')
export class HelpPostsController {
  constructor(@Inject(HelpPostsService) private readonly service: HelpPostsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: '求助帖列表（公开；默认 status=OPEN）' })
  @ApiOkResponse({ description: '分页：data 为 HelpPostView[]' })
  async list(@CurrentUser() auth: AuthUser | undefined, @Query() query: ListHelpPostsParams): Promise<Paginated<HelpPostView>> {
    return this.service.list(query, auth?.id);
  }

  @Post()
  @ApiOperation({ summary: '发布求助帖（分类白名单；5 篇/天）' })
  @ApiOkResponse({ description: 'HelpPostView' })
  async create(@CurrentUser() auth: AuthUser, @Body() dto: CreateHelpPostDto): Promise<HelpPostView> {
    return this.service.create(auth.id, dto);
  }
}
