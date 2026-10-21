import { Body, Controller, HttpCode, Inject, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { REPORT_REASONS } from '../../../moderation/moderation-state';
import { ReportsService } from '../../../moderation/endpoints/reports/reports.service';

class ReportConversationDto {
  @IsIn(REPORT_REASONS as unknown as string[]) reason!: string;
  @IsOptional() @IsString() @MaxLength(1000) details?: string;
  @IsOptional() @IsUUID('4') messageId?: string;
}

/**
 * POST /api/v1/conversations/:id/report — 契约：docs/modules/messaging/conversation-report.md
 * 举报会话或单条消息 → reports(targetType=CONVERSATION|MESSAGE)。
 */
@ApiTags('messaging')
@Controller('conversations')
export class ConversationReportController {
  constructor(@Inject(ReportsService) private readonly reports: ReportsService) {}

  @Post(':id/report')
  @HttpCode(200)
  @ApiOperation({ summary: '举报会话/消息（参与方；重复举报合并为 409）' })
  async report(@CurrentUser() auth: AuthUser, @Param('id') conversationId: string, @Body() dto: ReportConversationDto) {
    return this.reports.createForConversation(auth.id, conversationId, dto);
  }
}
