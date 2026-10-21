import { Controller, Headers, HttpCode, Inject, Param, Post } from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { IdempotencyService } from '../../../../common/idempotency/idempotency.service';
import { OrderView } from '../../care-view';
import { OrderCompleteService } from './order-complete.service';

/** POST /api/v1/care/orders/:id/complete — 契约：docs/modules/care/order-complete.md */
@ApiTags('care')
@Controller('care/orders')
export class OrderCompleteController {
  constructor(
    @Inject(OrderCompleteService) private readonly service: OrderCompleteService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
  ) {}

  @Post(':id/complete')
  @HttpCode(200)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: '提交/确认完成（服务者提交 → COMPLETION_SUBMITTED；需求方确认 → COMPLETED）' })
  @ApiOkResponse({ description: 'OrderView' })
  async complete(
    @CurrentUser() auth: AuthUser,
    @Param('id') id: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<OrderView> {
    const key = this.idempotency.requireKey(idempotencyKey);
    const requestHash = this.idempotency.hashBody({ op: 'care.orders.complete', orderId: id });
    return this.service.complete(id, auth.id, key, requestHash);
  }
}
