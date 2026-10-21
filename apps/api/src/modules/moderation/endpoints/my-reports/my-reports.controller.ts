import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { Paginated } from '../../../../common/pagination';
import { ReportView, ReportsService } from '../reports/reports.service';

class MyReportsParams {
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() pageSize?: string;
}

/** GET /api/v1/me/reports — 契约：docs/modules/reports/my-reports.md */
@ApiTags('moderation')
@Controller('me/reports')
export class MyReportsController {
  constructor(@Inject(ReportsService) private readonly service: ReportsService) {}

  @Get()
  @ApiOperation({ summary: '我的举报处理状态（不含他人信息）' })
  @ApiOkResponse({ description: '分页：data 为 ReportView[]' })
  async list(@CurrentUser() auth: AuthUser, @Query() query: MyReportsParams): Promise<Paginated<ReportView>> {
    return this.service.listMine(auth.id, query.page, query.pageSize);
  }
}
