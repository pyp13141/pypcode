import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { CareOrdersService } from './care-orders.service';
import { OfferingsController } from './endpoints/offerings/offerings.controller';
import { OfferingsService } from './endpoints/offerings/offerings.service';
import { OfferingByIdController } from './endpoints/offering-by-id/offering-by-id.controller';
import { OfferingByIdService } from './endpoints/offering-by-id/offering-by-id.service';
import { RequestsController } from './endpoints/requests/requests.controller';
import { RequestsService } from './endpoints/requests/requests.service';
import { RequestApplicationsController } from './endpoints/request-applications/request-applications.controller';
import { RequestApplicationsService } from './endpoints/request-applications/request-applications.service';
import { ApplicationAcceptController } from './endpoints/application-accept/application-accept.controller';
import { ApplicationAcceptService } from './endpoints/application-accept/application-accept.service';
import { ApplicationRejectController } from './endpoints/application-reject/application-reject.controller';
import { ApplicationRejectService } from './endpoints/application-reject/application-reject.service';
import { ApplicationWithdrawController } from './endpoints/application-withdraw/application-withdraw.controller';
import { ApplicationWithdrawService } from './endpoints/application-withdraw/application-withdraw.service';
import { OrdersController } from './endpoints/orders/orders.controller';
import { OrdersService } from './endpoints/orders/orders.service';
import { OrderByIdController } from './endpoints/order-by-id/order-by-id.controller';
import { OrderByIdService } from './endpoints/order-by-id/order-by-id.service';
import { OrderConfirmController } from './endpoints/order-confirm/order-confirm.controller';
import { OrderConfirmService } from './endpoints/order-confirm/order-confirm.service';
import { OrderStartController } from './endpoints/order-start/order-start.controller';
import { OrderStartService } from './endpoints/order-start/order-start.service';
import { OrderVisitsController } from './endpoints/order-visits/order-visits.controller';
import { OrderVisitsService } from './endpoints/order-visits/order-visits.service';
import { OrderVisitByIdController } from './endpoints/order-visit-by-id/order-visit-by-id.controller';
import { OrderVisitByIdService } from './endpoints/order-visit-by-id/order-visit-by-id.service';
import { OrderCompleteController } from './endpoints/order-complete/order-complete.controller';
import { OrderCompleteService } from './endpoints/order-complete/order-complete.service';
import { OrderCancelController } from './endpoints/order-cancel/order-cancel.controller';
import { OrderCancelService } from './endpoints/order-cancel/order-cancel.service';
import { OrderPrivateDetailsController } from './endpoints/order-private-details/order-private-details.controller';
import { OrderPrivateDetailsService } from './endpoints/order-private-details/order-private-details.service';
import { OrderDisputesController } from './endpoints/order-disputes/order-disputes.controller';
import { OrderDisputesService } from './endpoints/order-disputes/order-disputes.service';
import { OrderReviewsController } from './endpoints/order-reviews/order-reviews.controller';
import { OrderReviewsService } from './endpoints/order-reviews/order-reviews.service';

/**
 * 互助服务模块（M2）：公告/需求/申请/订单/Visit 五状态机 + 私密地址 + 履约凭证 + 评价/纠纷。
 * 契约总览 docs/modules/care.md；状态机权威 docs/STATE_MACHINES.md。
 * 关键事务：application-accept（行锁需求 → 过期其余申请 → 建单 → MATCHED，失败整体回滚）。
 */
@Module({
  imports: [NotificationsModule],
  controllers: [
    OfferingsController,
    OfferingByIdController,
    RequestsController,
    RequestApplicationsController,
    ApplicationAcceptController,
    ApplicationRejectController,
    ApplicationWithdrawController,
    OrdersController,
    OrderByIdController,
    OrderConfirmController,
    OrderStartController,
    OrderVisitsController,
    OrderVisitByIdController,
    OrderCompleteController,
    OrderCancelController,
    OrderPrivateDetailsController,
    OrderDisputesController,
    OrderReviewsController,
  ],
  providers: [
    CareOrdersService,
    OfferingsService,
    OfferingByIdService,
    RequestsService,
    RequestApplicationsService,
    ApplicationAcceptService,
    ApplicationRejectService,
    ApplicationWithdrawService,
    OrdersService,
    OrderByIdService,
    OrderConfirmService,
    OrderStartService,
    OrderVisitsService,
    OrderVisitByIdService,
    OrderCompleteService,
    OrderCancelService,
    OrderPrivateDetailsService,
    OrderDisputesService,
    OrderReviewsService,
  ],
  exports: [CareOrdersService],
})
export class CareModule {}
