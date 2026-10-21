import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { Paginated } from '../../../../common/pagination';
import { DEAL_STATUSES } from '../../market-state';
import { MarketDealView } from '../../market-view';
import { DealsService } from './deals.service';

class CreateDealDto {
  @IsUUID('4') listingId!: string;
  @IsOptional() @IsString() @MaxLength(500) message?: string;
}

class ListDealsParams {
  @IsOptional() @IsIn(DEAL_STATUSES as unknown as string[]) status?: string;
  @IsOptional() @IsIn(['BUYER', 'SELLER']) role?: string;
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() pageSize?: string;
}

/** POST/GET /api/v1/market/deals — 契约：docs/modules/market/deals.md */
@ApiTags('market')
@Controller('market/deals')
export class DealsController {
  constructor(@Inject(DealsService) private readonly service: DealsService) {}

  @Post()
  @ApiOperation({ summary: '发起交易（CONTACTED + 受限会话；不托管资金；幂等由卖家侧一物一单保证）' })
  @ApiOkResponse({ description: 'MarketDealView' })
  async create(@CurrentUser() auth: AuthUser, @Body() dto: CreateDealDto): Promise<MarketDealView> {
    return this.service.create(auth.id, dto);
  }

  @Get()
  @ApiOperation({ summary: '我的交易列表（仅交易双方）' })
  @ApiOkResponse({ description: '分页：data 为 MarketDealView[]' })
  async list(@CurrentUser() auth: AuthUser, @Query() query: ListDealsParams): Promise<Paginated<MarketDealView>> {
    return this.service.list(auth.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: '交易详情（仅参与方；非参与方 404 不泄露存在性）' })
  @ApiOkResponse({ description: 'MarketDealView（含 conversationId，用于进入受限会话）' })
  async getById(@CurrentUser() auth: AuthUser, @Param('id') id: string): Promise<MarketDealView> {
    return this.service.getById(auth.id, id);
  }
}
