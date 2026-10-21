import { Body, Controller, Headers, HttpCode, Inject, Param, Post } from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { IdempotencyService } from '../../../../common/idempotency/idempotency.service';
import { DealReviewsService } from './deal-reviews.service';

class CreateDealReviewDto {
  @IsInt() @Min(1) @Max(5) rating!: number;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsString() @MaxLength(500) content?: string;
}

/** POST /api/v1/market/deals/:id/reviews — 契约：docs/modules/market/deal-reviews.md */
@ApiTags('market')
@Controller('market/deals')
export class DealReviewsController {
  constructor(
    @Inject(DealReviewsService) private readonly service: DealReviewsService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
  ) {}

  @Post(':id/reviews')
  @HttpCode(200)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: '评价已完成交易（双向各一次；目标/角色服务端推导）' })
  @ApiOkResponse({ description: 'ReviewView' })
  async create(
    @CurrentUser() auth: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateDealReviewDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const key = this.idempotency.requireKey(idempotencyKey);
    const requestHash = this.idempotency.hashBody({ op: 'market.deals.reviews.create', dealId: id, body: dto });
    return this.service.create(id, auth.id, key, requestHash, dto);
  }
}
