import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { Public } from '../../../../common/decorators/public.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { RequestView } from '../../care-view';
import { Paginated } from '../../../../common/pagination';
import { CANCEL_RULES, PRICING_TYPES, SERVICE_TYPES } from '../../care-state';
import { RequestsService } from './requests.service';

class CreateRequestDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(5) @IsUUID('4', { each: true }) petIds!: string[];
  @IsIn(SERVICE_TYPES as unknown as string[]) serviceType!: string;
  @IsString() @Length(5, 50) title!: string;
  @IsString() @Length(1, 2000) description!: string;
  @IsString() @Length(2, 20) areaCode!: string;
  @IsString() startAt!: string;
  @IsString() endAt!: string;
  @IsOptional() @IsString() @MaxLength(100) frequency?: string;
  @IsIn(PRICING_TYPES as unknown as string[]) pricingType!: string;
  @IsOptional() @IsInt() @Min(0) priceMinor?: number;
  @IsIn(CANCEL_RULES as unknown as string[]) cancelRule!: string;
  @IsOptional() @IsString() @MaxLength(200) emergencyContact?: string;
  @IsOptional() @IsIn(['DRAFT', 'PUBLISHED']) status?: 'DRAFT' | 'PUBLISHED';
}

class ListRequestsParams {
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
 * GET/POST /api/v1/care/requests — 契约：docs/modules/care/requests.md
 * GET 公开检索（仅 PUBLISHED）；POST 须已有宠物档案（服务快照来源）。
 */
@ApiTags('care')
@Controller('care/requests')
export class RequestsController {
  constructor(@Inject(RequestsService) private readonly service: RequestsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: '求助需求列表（公开，仅 PUBLISHED；mine=true 需登录）' })
  @ApiOkResponse({ description: "分页：data 为 RequestView[]，meta 含 page/pageSize/total" })
  async list(@CurrentUser() auth: AuthUser | undefined, @Query() query: ListRequestsParams): Promise<Paginated<RequestView>> {
    return this.service.list(query, auth?.id);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: '求助需求详情（公开仅 PUBLISHED；本人可见全状态；其余 404）' })
  @ApiOkResponse({ description: 'RequestView（绝不含精确地址/门禁/紧急联系人）' })
  async getById(@CurrentUser() auth: AuthUser | undefined, @Param('id') id: string): Promise<RequestView> {
    return this.service.getById(id, auth?.id);
  }

  @Post()
  @ApiOperation({ summary: '发布求助需求（须已有宠物档案；响应绝不含精确地址）' })
  @ApiOkResponse({ description: "RequestView" })
  async create(@CurrentUser() auth: AuthUser, @Body() dto: CreateRequestDto): Promise<RequestView> {
    return this.service.create(auth.id, dto);
  }
}
