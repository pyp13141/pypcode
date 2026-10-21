import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { OrderView } from '../../care-view';
import { OrderByIdService } from './order-by-id.service';

/** GET /api/v1/care/orders/:id — 契约：docs/modules/care/order-by-id.md */
@ApiTags('care')
@Controller('care/orders')
export class OrderByIdController {
  constructor(@Inject(OrderByIdService) private readonly service: OrderByIdService) {}

  @Get(':id')
  @ApiOperation({ summary: '订单详情（仅参与方；含条款快照与上门记录，不含私密地址）' })
  @ApiOkResponse({ description: 'OrderView（含 visits[].evidence）' })
  async get(@CurrentUser() auth: AuthUser, @Param('id') id: string): Promise<OrderView> {
    return this.service.get(id, auth.id);
  }
}
