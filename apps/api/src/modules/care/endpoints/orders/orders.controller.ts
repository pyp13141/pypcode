import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { Paginated } from '../../../../common/pagination';
import { ORDER_STATUSES } from '../../care-state';
import { OrderView } from '../../care-view';
import { OrdersService } from './orders.service';

class ListOrdersParams {
  @IsOptional() @IsIn(['REQUESTER', 'PROVIDER']) role?: string;
  @IsOptional() @IsIn(ORDER_STATUSES as unknown as string[]) status?: string;
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() pageSize?: string;
}

/** GET /api/v1/care/orders — 契约：docs/modules/care/orders.md */
@ApiTags('care')
@Controller('care/orders')
export class OrdersController {
  constructor(@Inject(OrdersService) private readonly service: OrdersService) {}

  @Get()
  @ApiOperation({ summary: '我的订单列表（参与方；?role=REQUESTER|PROVIDER&status=）' })
  @ApiOkResponse({ description: '分页：data 为 OrderView[]（地址等私密字段不在本响应）' })
  async list(@CurrentUser() auth: AuthUser, @Query() query: ListOrdersParams): Promise<Paginated<OrderView>> {
    return this.service.list(auth.id, query);
  }
}
