import { Body, Controller, Get, Inject, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { Public } from '../../../../common/decorators/public.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { OfferingSummaryView } from '../../care-view';
import { Paginated } from '../../../../common/pagination';
import { CANCEL_RULES, PRICING_TYPES, SERVICE_TYPES } from '../../care-state';
import { OfferingsService } from './offerings.service';

class AvailabilityDto {
  @IsString() startAt!: string;
  @IsString() endAt!: string;
  @IsOptional() @IsInt() @Min(1) @Max(99) capacity?: number;
}

class CreateOfferingDto {
  @IsIn(SERVICE_TYPES as unknown as string[]) serviceType!: string;
  @IsString() @Length(5, 50) title!: string;
  @IsString() @Length(1, 2000) description!: string;
  @IsString() @Length(2, 20) areaCode!: string;
  @IsOptional() @IsNumber() @Min(0.1) @Max(100) radiusKm?: number;
  @IsIn(PRICING_TYPES as unknown as string[]) pricingType!: string;
  @IsOptional() @IsInt() @Min(0) priceMinor?: number;
  @IsIn(CANCEL_RULES as unknown as string[]) cancelRule!: string;
  @IsOptional() @IsIn(['DRAFT', 'PUBLISHED']) status?: 'DRAFT' | 'PUBLISHED';
  @IsOptional() @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => AvailabilityDto)
  availabilities?: AvailabilityDto[];
}

class ListOfferingsParams {
  @IsOptional() @IsString() areaCode?: string;
  @IsOptional() @IsIn(SERVICE_TYPES as unknown as string[]) serviceType?: string;
  @IsOptional() @IsString() dateFrom?: string;
  @IsOptional() @IsString() dateTo?: string;
  @IsOptional() @IsIn(PRICING_TYPES as unknown as string[]) pricingType?: string;
  @IsOptional() @IsIn(['true', 'false']) mine?: string;
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() pageSize?: string;
}

/**
 * GET/POST /api/v1/care/offerings — 契约：docs/modules/care/offerings.md
 * GET 公开（未登录可浏览；mine=true 需登录看本人全状态）；POST 需登录（运营开关可要求手机号验证）。
 */
@ApiTags('care')
@Controller('care/offerings')
export class OfferingsController {
  constructor(@Inject(OfferingsService) private readonly service: OfferingsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: '服务公告列表（公开，仅 PUBLISHED；含服务者信任摘要）' })
  @ApiOkResponse({ description: "分页：data 为 OfferingSummaryView[]，meta 含 page/pageSize/total" })
  async list(@CurrentUser() auth: AuthUser | undefined, @Query() query: ListOfferingsParams): Promise<Paginated<OfferingSummaryView>> {
    return this.service.list(query, auth?.id);
  }

  @Post()
  @ApiOperation({ summary: '发布服务公告（创建即 PUBLISHED 或 DRAFT）' })
  @ApiOkResponse({ description: "OfferingSummaryView" })
  async create(@CurrentUser() auth: AuthUser, @Body() dto: CreateOfferingDto): Promise<OfferingSummaryView> {
    return this.service.create(auth.id, {
      ...dto,
      availabilities: dto.availabilities ?? [],
    });
  }
}
