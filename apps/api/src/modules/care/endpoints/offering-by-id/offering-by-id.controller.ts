import { Body, Controller, Get, Inject, Param, Patch } from '@nestjs/common';
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
import { OfferingDetailView } from '../../care-view';
import { CANCEL_RULES, PRICING_TYPES } from '../../care-state';
import { OfferingByIdService } from './offering-by-id.service';

class PatchAvailabilityDto {
  @IsString() startAt!: string;
  @IsString() endAt!: string;
  @IsOptional() @IsInt() @Min(1) @Max(99) capacity?: number;
}

class PatchOfferingDto {
  @IsOptional() @IsString() @Length(5, 50) title?: string;
  @IsOptional() @IsString() @Length(1, 2000) description?: string;
  @IsOptional() @IsString() @Length(2, 20) areaCode?: string;
  @IsOptional() @IsNumber() @Min(0.1) @Max(100) radiusKm?: number;
  @IsOptional() @IsIn(PRICING_TYPES as unknown as string[]) pricingType?: string;
  @IsOptional() @IsInt() @Min(0) priceMinor?: number;
  @IsOptional() @IsIn(CANCEL_RULES as unknown as string[]) cancelRule?: string;
  @IsOptional() @IsIn(['PUBLISHED', 'PAUSED', 'ARCHIVED']) status?: 'PUBLISHED' | 'PAUSED' | 'ARCHIVED';
  @IsOptional() @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => PatchAvailabilityDto)
  availabilities?: PatchAvailabilityDto[];
}

/**
 * GET/PATCH /api/v1/care/offerings/:id — 契约：docs/modules/care/offering-by-id.md
 * 价格类型/金额变更只影响后续新订单；存量订单条款是快照，不受影响（API §3）。
 */
@ApiTags('care')
@Controller('care/offerings')
export class OfferingByIdController {
  constructor(@Inject(OfferingByIdService) private readonly service: OfferingByIdService) {}

  @Get(':id')
  @Public()
  @ApiOperation({ summary: '服务公告详情（公开仅 PUBLISHED；owner 可见全状态）' })
  @ApiOkResponse({ description: "OfferingDetailView" })
  async get(@CurrentUser() auth: AuthUser | undefined, @Param('id') id: string): Promise<OfferingDetailView> {
    return this.service.get(id, auth?.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新本人服务公告（含状态流转 DRAFT→PUBLISHED↔PAUSED→ARCHIVED）' })
  @ApiOkResponse({ description: "OfferingDetailView" })
  async patch(@CurrentUser() auth: AuthUser, @Param('id') id: string, @Body() dto: PatchOfferingDto): Promise<OfferingDetailView> {
    return this.service.patch(id, auth.id, dto);
  }
}
