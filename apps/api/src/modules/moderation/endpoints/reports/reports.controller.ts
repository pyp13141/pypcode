import { Body, Controller, Inject, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { REPORT_REASONS, REPORT_TARGET_TYPES } from '../../moderation-state';
import { ReportView, ReportsService } from './reports.service';

class CreateReportDto {
  @IsIn(REPORT_TARGET_TYPES as unknown as string[]) targetType!: string;
  @IsUUID('4') targetId!: string;
  @IsIn(REPORT_REASONS as unknown as string[]) reason!: string;
  @IsOptional() @IsString() @MaxLength(1000) details?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(9) @IsUUID('4', { each: true }) images?: string[];
}

/** POST /api/v1/reports — 契约：docs/modules/reports/reports.md */
@ApiTags('moderation')
@Controller('reports')
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly service: ReportsService) {}

  @Post()
  @ApiOperation({ summary: '提交内容举报（重复举报合并；进入后台队列）' })
  @ApiOkResponse({ description: 'ReportView' })
  async create(@CurrentUser() auth: AuthUser, @Body() dto: CreateReportDto): Promise<ReportView> {
    return this.service.create(auth.id, dto);
  }
}
