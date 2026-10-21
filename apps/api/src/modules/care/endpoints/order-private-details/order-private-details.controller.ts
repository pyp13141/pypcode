import { Body, Controller, Get, Inject, Param, Put } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { RequestId } from '../../../../common/decorators/request-id.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { OrderPrivateDetailsService, PrivateDetailsView } from './order-private-details.service';

class PutPrivateDetailsDto {
  @IsString() @Length(1, 300) address!: string;
  @IsOptional() @IsString() @MaxLength(500) entryInstructions?: string;
  @IsOptional() @IsString() @MaxLength(200) emergencyContact?: string;
}

/**
 * GET/PUT /api/v1/care/orders/:id/private-details ⭐敏感 — 契约：docs/modules/care/order-private-details.md
 * 每次读写都写 sensitive_access_logs（审计写入失败即请求失败）。
 */
@ApiTags('care')
@Controller('care/orders')
export class OrderPrivateDetailsController {
  constructor(@Inject(OrderPrivateDetailsService) private readonly service: OrderPrivateDetailsService) {}

  @Get(':id/private-details')
  @ApiOperation({ summary: '读取私密履约信息（参与方且订单已确认；每次读取写审计）' })
  @ApiOkResponse({ description: '{ address, entryInstructions, emergencyContact, accessPolicy, updatedAt }' })
  async get(
    @CurrentUser() auth: AuthUser,
    @Param('id') id: string,
    @RequestId() requestId?: string,
  ): Promise<PrivateDetailsView> {
    return this.service.get(id, auth.id, requestId);
  }

  @Put(':id/private-details')
  @ApiOperation({ summary: '登记/更新私密履约信息（仅需求方；AES-256-GCM；每次写入写审计）' })
  @ApiOkResponse({ description: 'PrivateDetailsView（不落日志、不进通用订单响应）' })
  async put(
    @CurrentUser() auth: AuthUser,
    @Param('id') id: string,
    @Body() dto: PutPrivateDetailsDto,
    @RequestId() requestId?: string,
  ): Promise<PrivateDetailsView> {
    return this.service.put(id, auth.id, { ...dto, requestId });
  }
}
