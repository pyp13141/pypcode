import { Body, Controller, Get, Inject, Param, Patch } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, MaxLength, Min } from 'class-validator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { Public } from '../../../../common/decorators/public.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { LISTING_CONDITIONS } from '../../market-state';
import { MarketListingDetailView } from '../../market-view';
import { ListingByIdService } from './listing-by-id.service';

class PatchListingDto {
  @IsOptional() @IsString() @Length(5, 50) title?: string;
  @IsOptional() @IsString() @Length(1, 2000) description?: string;
  @IsOptional() @IsInt() @Min(0) priceMinor?: number;
  @IsOptional() @IsIn(LISTING_CONDITIONS as unknown as string[]) condition?: string;
  @IsOptional() @IsString() @Length(2, 20) areaCode?: string;
  @IsOptional() @IsString() @MaxLength(100) handoverWindow?: string;
  @IsOptional() @IsString() @Length(1, 40) categoryCode?: string;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) images?: string[];
  @IsOptional() @IsIn(['PUBLISHED', 'EXPIRED']) status?: 'PUBLISHED' | 'EXPIRED';
}

/** GET/PATCH /api/v1/market/listings/:id — 契约：docs/modules/market/listing-by-id.md */
@ApiTags('market')
@Controller('market/listings')
export class ListingByIdController {
  constructor(@Inject(ListingByIdService) private readonly service: ListingByIdService) {}

  @Get(':id')
  @Public()
  @ApiOperation({ summary: '列表详情（公开仅 PUBLISHED；owner 可见全状态；含安全提示）' })
  @ApiOkResponse({ description: 'MarketListingDetailView' })
  async get(@CurrentUser() auth: AuthUser | undefined, @Param('id') id: string): Promise<MarketListingDetailView> {
    return this.service.get(id, auth?.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新本人列表（SOLD/REMOVED 后关键字段禁改；上架时 HIGH 类目转人工审核）' })
  @ApiOkResponse({ description: 'MarketListingDetailView' })
  async patch(@CurrentUser() auth: AuthUser, @Param('id') id: string, @Body() dto: PatchListingDto): Promise<MarketListingDetailView> {
    return this.service.patch(id, auth.id, dto);
  }
}