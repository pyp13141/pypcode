import { Body, Controller, HttpCode, Inject, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { DEAL_CANCEL_REASON_CODES } from '../../market-state';
import { MarketDealView } from '../../market-view';
import { DealCancelService } from './deal-cancel.service';

class CancelDealDto {
  @IsIn(DEAL_CANCEL_REASON_CODES as unknown as string[]) reasonCode!: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

/** POST /api/v1/market/deals/:id/cancel — 契约：docs/modules/market/deal-cancel.md */
@ApiTags('market')
@Controller('market/deals')
export class DealCancelController {
  constructor(@Inject(DealCancelService) private readonly service: DealCancelService) {}

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: '取消交易（任一方；记原因码）' })
  @ApiOkResponse({ description: 'MarketDealView' })
  async cancel(@CurrentUser() auth: AuthUser, @Param('id') id: string, @Body() dto: CancelDealDto): Promise<MarketDealView> {
    return this.service.cancel(id, auth.id, dto.reasonCode, dto.note);
  }
}
