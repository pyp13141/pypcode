import { Controller, HttpCode, Inject, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { OrderView } from '../../care-view';
import { OrderStartService } from './order-start.service';

/** POST /api/v1/care/orders/:id/start — 契约：docs/modules/care/order-start.md */
@ApiTags('care')
@Controller('care/orders')
export class OrderStartController {
  constructor(@Inject(OrderStartService) private readonly service: OrderStartService) {}

  @Post(':id/start')
  @HttpCode(200)
  @ApiOperation({ summary: '开始服务（仅服务者；CONFIRMED→IN_PROGRESS；±24h 时间窗）' })
  @ApiOkResponse({ description: 'OrderView' })
  async start(@CurrentUser() auth: AuthUser, @Param('id') id: string): Promise<OrderView> {
    return this.service.start(id, auth.id);
  }
}
