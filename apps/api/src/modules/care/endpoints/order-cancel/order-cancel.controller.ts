import { Body, Controller, HttpCode, Inject, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { OrderView } from '../../care-view';
import { CANCEL_REASON_CODES } from '../../care-state';
import { OrderCancelService } from './order-cancel.service';

class CancelOrderDto {
  @IsIn(CANCEL_REASON_CODES as unknown as string[]) reasonCode!: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

/** POST /api/v1/care/orders/:id/cancel — 契约：docs/modules/care/order-cancel.md */
@ApiTags('care')
@Controller('care/orders')
export class OrderCancelController {
  constructor(@Inject(OrderCancelService) private readonly service: OrderCancelService) {}

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: '取消订单/发起取消申请（按 agreedTerms.cancelRule；写 reason_code）' })
  @ApiOkResponse({ description: 'OrderView' })
  async cancel(
    @CurrentUser() auth: AuthUser,
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
  ): Promise<OrderView> {
    return this.service.cancel(id, auth.id, dto.reasonCode, dto.note);
  }
}
