import { Body, Controller, HttpCode, Inject, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsString, Length } from 'class-validator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { MARKET_DISPUTE_REASON_CODES } from '../../market-state';
import { DealDisputesService, MarketDisputeView } from './deal-disputes.service';

class OpenDealDisputeDto {
  @IsIn(MARKET_DISPUTE_REASON_CODES as unknown as string[]) reasonCode!: string;
  @IsString() @Length(5, 1000) description!: string;
}

/** POST /api/v1/market/deals/:id/disputes — 契约：docs/modules/market/deal-disputes.md */
@ApiTags('market')
@Controller('market/deals')
export class DealDisputesController {
  constructor(@Inject(DealDisputesService) private readonly service: DealDisputesService) {}

  @Post(':id/disputes')
  @HttpCode(200)
  @ApiOperation({ summary: '发起交易纠纷（创建工单；交易进入 DISPUTED）' })
  @ApiOkResponse({ description: 'MarketDisputeView' })
  async open(@CurrentUser() auth: AuthUser, @Param('id') id: string, @Body() dto: OpenDealDisputeDto): Promise<MarketDisputeView> {
    return this.service.open(id, auth.id, dto.reasonCode, dto.description);
  }
}
