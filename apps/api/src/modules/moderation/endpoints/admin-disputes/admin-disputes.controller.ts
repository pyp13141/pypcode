import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import { RequestId } from '../../../../common/decorators/request-id.decorator';
import { AdminGuard } from '../../admin.guard';
import { AdminRoles } from '../../admin-roles.decorator';
import { CurrentAdmin } from '../../current-admin.decorator';
import { AdminActor } from '../../admin.guard';
import { DISPUTE_RESOLUTION_CODES, DISPUTE_STATUSES } from '../../moderation-state';
import { AdminDisputesService } from './admin-disputes.service';

class ListDisputesParams {
  @IsOptional() @IsIn(DISPUTE_STATUSES as unknown as string[]) status?: string;
  @IsOptional() @IsIn(['CARE', 'MARKET']) caseType?: string;
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() pageSize?: string;
}

class EvidenceDto {
  @IsString() @Length(2, 1000) note!: string;
}

class RulingDto {
  @IsIn(DISPUTE_RESOLUTION_CODES as unknown as string[]) resolutionCode!: string;
  @IsString() @Length(2, 1000) reason!: string;
}

class AppealDto {
  @IsString() @Length(2, 1000) reason!: string;
}

/** 纠纷处理（API §6） — 契约：docs/modules/report-admin/admin-disputes.md */
@ApiTags('admin')
@Controller('admin/disputes')
@UseGuards(AdminGuard)
export class AdminDisputesController {
  constructor(@Inject(AdminDisputesService) private readonly service: AdminDisputesService) {}

  @Get()
  @AdminRoles('support_operator')
  @ApiOperation({ summary: '纠纷列表（含业务对象摘要；不含私密地址）' })
  async list(@Query() query: ListDisputesParams) {
    return this.service.list(query);
  }

  @Post(':id/evidence')
  @HttpCode(200)
  @AdminRoles('support_operator')
  @ApiOperation({ summary: '补充证据/说明（追加式事件）' })
  async evidence(@CurrentAdmin() admin: AdminActor, @Param('id') id: string, @Body() dto: EvidenceDto, @RequestId() requestId?: string) {
    return this.service.addEvidence(admin.userId, id, dto.note, requestId);
  }

  @Post(':id/ruling')
  @HttpCode(200)
  @AdminRoles('support_operator')
  @ApiOperation({ summary: '裁定（COMPLETED/CANCELLED/NO_FAULT；驱动订单/交易终态 + 审计 + 通知双方）' })
  async ruling(@CurrentAdmin() admin: AdminActor, @Param('id') id: string, @Body() dto: RulingDto, @RequestId() requestId?: string) {
    return this.service.ruling(admin.userId, id, dto.resolutionCode, dto.reason, requestId);
  }

  @Post(':id/appeal')
  @HttpCode(200)
  @AdminRoles('support_operator')
  @ApiOperation({ summary: '申诉（已裁定 → APPEALING）' })
  async appeal(@CurrentAdmin() admin: AdminActor, @Param('id') id: string, @Body() dto: AppealDto, @RequestId() requestId?: string) {
    return this.service.appeal(admin.userId, id, dto.reason, requestId);
  }
}
