import { Body, Controller, HttpCode, Inject, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsString, Length, MaxLength } from 'class-validator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { DISPUTE_REASON_CODES } from '../../care-state';
import { OrderDisputesService, DisputeView } from './order-disputes.service';

class OpenDisputeDto {
  @IsIn(DISPUTE_REASON_CODES as unknown as string[]) reasonCode!: string;
  @IsString() @Length(5, 1000) description!: string;
}

/** POST /api/v1/care/orders/:id/disputes — 契约：docs/modules/care/order-disputes.md */
@ApiTags('care')
@Controller('care/orders')
export class OrderDisputesController {
  constructor(@Inject(OrderDisputesService) private readonly service: OrderDisputesService) {}

  @Post(':id/disputes')
  @HttpCode(200)
  @ApiOperation({ summary: '发起服务纠纷（创建 disputes 工单；订单进入 DISPUTED）' })
  @ApiOkResponse({ description: 'DisputeView' })
  async open(
    @CurrentUser() auth: AuthUser,
    @Param('id') id: string,
    @Body() dto: OpenDisputeDto,
  ): Promise<DisputeView> {
    return this.service.open(id, auth.id, dto.reasonCode, dto.description);
  }
}
