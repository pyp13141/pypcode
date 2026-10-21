import { Body, Controller, Headers, Inject, Param, Post } from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { IdempotencyService } from '../../../../common/idempotency/idempotency.service';
import { VisitView } from '../../care-view';
import { OrderVisitsService } from './order-visits.service';

class CreateVisitDto {
  @IsString() scheduledAt!: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

/** POST /api/v1/care/orders/:id/visits — 契约：docs/modules/care/order-visits.md */
@ApiTags('care')
@Controller('care/orders')
export class OrderVisitsController {
  constructor(
    @Inject(OrderVisitsService) private readonly service: OrderVisitsService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
  ) {}

  @Post(':id/visits')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: '创建单次上门记录（幂等键；IN_PROGRESS 下；多频次订单）' })
  @ApiOkResponse({ description: 'VisitView' })
  async create(
    @CurrentUser() auth: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateVisitDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<VisitView> {
    const key = this.idempotency.requireKey(idempotencyKey);
    const requestHash = this.idempotency.hashBody({ op: 'care.orders.visits.create', orderId: id, body: dto });
    return this.service.create(id, auth.id, key, requestHash, dto);
  }
}
