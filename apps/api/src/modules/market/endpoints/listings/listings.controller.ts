import { Body, Controller, Get, Inject, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, MaxLength, Min } from 'class-validator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { Public } from '../../../../common/decorators/public.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { Paginated } from '../../../../common/pagination';
import { LISTING_CONDITIONS, LISTING_TYPES } from '../../market-state';
import { MarketListingSummaryView } from '../../market-view';
import { ListingsService } from './listings.service';

class CreateListingDto {
  @IsIn(LISTING_TYPES as unknown as string[]) listingType!: string;
  @IsString() @Length(1, 40) categoryCode!: string;
  @IsString() @Length(5, 50) title!: string;
  @IsString() @Length(1, 2000) description!: string;
  @IsOptional() @IsInt() @Min(0) priceMinor?: number;
  @IsOptional() @IsIn(LISTING_CONDITIONS as unknown as string[]) condition?: string;
  @IsString() @Length(2, 20) areaCode!: string;
  @IsOptional() @IsString() @MaxLength(100) handoverWindow?: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(9) @IsUUID('4', { each: true }) images!: string[];
}

class ListParams {
  @IsOptional() @IsIn(LISTING_TYPES as unknown as string[]) listingType?: string;
  @IsOptional() @IsString() categoryCode?: string;
  @IsOptional() @IsString() areaCode?: string;
  @IsOptional() @IsString() priceMin?: string;
  @IsOptional() @IsString() priceMax?: string;
  @IsOptional() @IsString() @MaxLength(50) keyword?: string;
  @IsOptional() @IsIn(['true', 'false']) mine?: string;
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() pageSize?: string;
}

/**
 * GET/POST /api/v1/market/listings — 契约：docs/modules/market/listings.md
 * 公开检索仅 PUBLISHED；HIGH 风险类目（宠物食品/药品）发布进 PENDING_REVIEW 人工审核。
 */
@ApiTags('market')
@Controller('market/listings')
export class ListingsController {
  constructor(@Inject(ListingsService) private readonly service: ListingsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: '集市列表（公开；关键词/分类/区域/价格区间过滤）' })
  @ApiOkResponse({ description: '分页：data 为 MarketListingSummaryView[]' })
  async list(@CurrentUser() auth: AuthUser | undefined, @Query() query: ListParams): Promise<Paginated<MarketListingSummaryView>> {
    return this.service.list(query, auth?.id);
  }

  @Post()
  @ApiOperation({ summary: '发布闲置（图片须先经媒体管线上传；HIGH 风险类目转人工审核）' })
  @ApiOkResponse({ description: 'MarketListingSummaryView' })
  async create(@CurrentUser() auth: AuthUser, @Body() dto: CreateListingDto): Promise<MarketListingSummaryView> {
    return this.service.create(auth.id, dto);
  }
}
