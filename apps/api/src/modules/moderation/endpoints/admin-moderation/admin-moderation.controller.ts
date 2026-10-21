import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import { RequestId } from '../../../../common/decorators/request-id.decorator';
import { AdminGuard } from '../../admin.guard';
import { AdminRoles } from '../../admin-roles.decorator';
import { CurrentAdmin } from '../../current-admin.decorator';
import { AdminActor } from '../../admin.guard';
import { AdminModerationService } from './admin-moderation.service';

class QueueParams {
  @IsOptional() @IsIn(['POST', 'LISTING']) type?: string;
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() pageSize?: string;
}

class DecisionDto {
  @IsIn(['POST', 'LISTING']) targetType!: string;
  @IsIn(['APPROVE', 'REMOVE']) decision!: string;
  @IsString() @Length(2, 200) reason!: string;
}

/** GET /admin/moderation/queue + POST /admin/moderation/:id/decision — 契约：docs/modules/report-admin/admin-moderation.md */
@ApiTags('admin')
@Controller('admin/moderation')
@UseGuards(AdminGuard)
export class AdminModerationController {
  constructor(@Inject(AdminModerationService) private readonly service: AdminModerationService) {}

  @Get('queue')
  @AdminRoles('content_moderator')
  @ApiOperation({ summary: '审核队列（待审帖子 + 待审商品，理由与证据引用见 decision）' })
  async queue(@Query() query: QueueParams) {
    return this.service.queue(query.type, query.page, query.pageSize);
  }

  @Post(':id/decision')
  @HttpCode(200)
  @AdminRoles('content_moderator')
  @ApiOperation({ summary: '审核决定（APPROVE/REMOVE，理由必填；写 moderation_actions + 审计 + 通知作者）' })
  async decide(
    @CurrentAdmin() admin: AdminActor,
    @Param('id') id: string,
    @Body() dto: DecisionDto,
    @RequestId() requestId?: string,
  ) {
    return this.service.decide(admin.userId, id, dto.targetType, dto.decision, dto.reason, requestId);
  }
}
