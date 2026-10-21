import { Controller, HttpCode, Inject, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { OrderView } from '../../care-view';
import { OrderConfirmService } from './order-confirm.service';

/** POST /api/v1/care/orders/:id/confirm — 契约：docs/modules/care/order-confirm.md */
@ApiTags('care')
@Controller('care/orders')
export class OrderConfirmController {
  constructor(@Inject(OrderConfirmService) private readonly service: OrderConfirmService) {}

  @Post(':id/confirm')
  @HttpCode(200)
  @ApiOperation({ summary: '确认订单条款（双方各自确认；都确认后 CONFIRMED）' })
  @ApiOkResponse({ description: 'OrderView' })
  async confirm(@CurrentUser() auth: AuthUser, @Param('id') id: string): Promise<OrderView> {
    return this.service.confirm(id, auth.id);
  }
}
