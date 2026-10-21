import { Body, Controller, Inject, Param, Patch } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { RequestId } from '../../../../common/decorators/request-id.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { VisitView } from '../../care-view';
import { OrderVisitByIdService } from './order-visit-by-id.service';

class EvidenceDto {
  @IsIn(['NOTE', 'PHOTO']) evidenceType!: 'NOTE' | 'PHOTO';
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

class PatchVisitDto {
  @IsIn(['START', 'COMPLETE', 'EXCEPTION', 'MISSED', 'CANCEL']) action!: 'START' | 'COMPLETE' | 'EXCEPTION' | 'MISSED' | 'CANCEL';
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(9) @ValidateNested({ each: true }) @Type(() => EvidenceDto)
  evidence?: EvidenceDto[];
}

/** PATCH /api/v1/care/orders/:id/visits/:visitId — 契约：docs/modules/care/order-visit-by-id.md */
@ApiTags('care')
@Controller('care/orders')
export class OrderVisitByIdController {
  constructor(@Inject(OrderVisitByIdService) private readonly service: OrderVisitByIdService) {}

  @Patch(':id/visits/:visitId')
  @ApiOperation({ summary: '更新单次上门（仅服务者；开始/完成/异常；可附 NOTE 凭证）' })
  @ApiOkResponse({ description: 'VisitView' })
  async patch(
    @CurrentUser() auth: AuthUser,
    @Param('id') id: string,
    @Param('visitId') visitId: string,
    @Body() dto: PatchVisitDto,
    @RequestId() requestId?: string,
  ): Promise<VisitView> {
    return this.service.patch(id, visitId, auth.id, { ...dto, requestId });
  }
}
