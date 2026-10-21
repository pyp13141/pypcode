import { Body, Controller, HttpCode, Inject, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { MarketDealView } from '../../market-view';
import { DealAgreeService } from './deal-agree.service';

class AgreeDto {
  @IsOptional() @IsString() handoverAt?: string;
  @IsOptional() @IsString() @MaxLength(100) handoverArea?: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

/** POST /api/v1/market/deals/:id/agree — 契约：docs/modules/market/deal-agree.md */
@ApiTags('market')
@Controller('market/deals')
export class DealAgreeController {
  constructor(@Inject(DealAgreeService) private readonly service: DealAgreeService) {}

  @Post(':id/agree')
  @HttpCode(200)
  @ApiOperation({ summary: '确认交接约定（双方各自确认；都确认后 AGREED）' })
  @ApiOkResponse({ description: 'MarketDealView' })
  async agree(@CurrentUser() auth: AuthUser, @Param('id') id: string, @Body() dto: AgreeDto): Promise<MarketDealView> {
    return this.service.agree(id, auth.id, dto);
  }
}
