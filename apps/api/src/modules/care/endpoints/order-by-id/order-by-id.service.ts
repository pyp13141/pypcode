import { Inject, Injectable } from '@nestjs/common';
import { CareOrdersService } from '../../care-orders.service';
import { OrderView } from '../../care-view';

/**
 * GET /api/v1/care/orders/:id — 契约：docs/modules/care/order-by-id.md
 * 仅参与方（非参与方 404，不泄露存在性）；含条款快照与 visit/凭证列表；
 * 地址/门禁/紧急联系人绝不在本响应，走独立接口 private-details。
 */
@Injectable()
export class OrderByIdService {
  constructor(@Inject(CareOrdersService) private readonly orders: CareOrdersService) {}

  async get(orderId: string, userId: string): Promise<OrderView> {
    return this.orders.loadOrderView(orderId, userId);
  }
}
