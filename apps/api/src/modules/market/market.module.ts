import { Module } from '@nestjs/common';
import { CareModule } from '../care/care.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MarketDealsService } from './market-deals.service';
import { ListingsController } from './endpoints/listings/listings.controller';
import { ListingsService } from './endpoints/listings/listings.service';
import { ListingByIdController } from './endpoints/listing-by-id/listing-by-id.controller';
import { ListingByIdService } from './endpoints/listing-by-id/listing-by-id.service';
import { ListingFavoriteController } from './endpoints/listing-favorite/listing-favorite.controller';
import { ListingFavoriteService } from './endpoints/listing-favorite/listing-favorite.service';
import { DealsController } from './endpoints/deals/deals.controller';
import { DealsService } from './endpoints/deals/deals.service';
import { DealAgreeController } from './endpoints/deal-agree/deal-agree.controller';
import { MarketCategoriesController } from './endpoints/market-categories/market-categories.controller';
import { DealAgreeService } from './endpoints/deal-agree/deal-agree.service';
import { DealCompleteController } from './endpoints/deal-complete/deal-complete.controller';
import { DealCompleteService } from './endpoints/deal-complete/deal-complete.service';
import { DealCancelController } from './endpoints/deal-cancel/deal-cancel.controller';
import { DealCancelService } from './endpoints/deal-cancel/deal-cancel.service';
import { DealDisputesController } from './endpoints/deal-disputes/deal-disputes.controller';
import { DealDisputesService } from './endpoints/deal-disputes/deal-disputes.service';
import { DealReviewsController } from './endpoints/deal-reviews/deal-reviews.controller';
import { DealReviewsService } from './endpoints/deal-reviews/deal-reviews.service';

/**
 * 集市与交易模块（M3）：列表发布/检索/收藏 + 交易全链（联系→约定→交接→完成/纠纷/评价）。
 * 契约总览 docs/modules/market.md；状态机 docs/STATE_MACHINES.md §6。
 * 一物一单：同意交接起跨买家互斥，交接时行锁 listing 原子关闭（D-012）。
 * 信任摘要复用 care 模块导出的 CareOrdersService（模块边界：只经对方 Module 导出调用）。
 */
@Module({
  imports: [CareModule, NotificationsModule],
  controllers: [
    MarketCategoriesController,
    ListingsController,
    ListingByIdController,
    ListingFavoriteController,
    DealsController,
    DealAgreeController,
    DealCompleteController,
    DealCancelController,
    DealDisputesController,
    DealReviewsController,
  ],
  providers: [
    MarketDealsService,
    ListingsService,
    ListingByIdService,
    ListingFavoriteService,
    DealsService,
    DealAgreeService,
    DealCompleteService,
    DealCancelService,
    DealDisputesService,
    DealReviewsService,
  ],
})
export class MarketModule {}
