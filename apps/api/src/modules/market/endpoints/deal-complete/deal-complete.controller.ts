import { Controller, HttpCode, Inject, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { MarketDealView } from '../../market-view';
import { DealCompleteService } from './deal-complete.service';

/** POST /api/v1/market/deals/:id/complete — 契约：docs/modules/market/deal-complete.md */
@ApiTags('market')
@Controller('market/deals')
export class DealCompleteController {
  constructor(@Inject(DealCompleteService) private readonly service: DealCompleteService) {}

  @Post(':id/complete')
  @HttpCode(200)
  @ApiOperation({ summary: '确认已交接（双方各自确认；首方确认即原子关闭物品）' })
  @ApiOkResponse({ description: 'MarketDealView' })
  async complete(@CurrentUser() auth: AuthUser, @Param('id') id: string): Promise<MarketDealView> {
    return this.service.complete(id, auth.id);
  }
}
