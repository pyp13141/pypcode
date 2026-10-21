import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length, Min } from 'class-validator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { ApplicationView } from '../../care-view';
import { RequestApplicationsService } from './request-applications.service';

class CreateApplicationDto {
  @IsString() @Length(1, 500) message!: string;
  @IsOptional() @IsInt() @Min(0) proposedPriceMinor?: number;
}

/**
 * GET/POST /api/v1/care/requests/:id/applications — 契约：docs/modules/care/request-applications.md
 * 申请独立于需求状态，创建申请不创建订单（产品 5.1.4）。
 */
@ApiTags('care')
@Controller('care/requests')
export class RequestApplicationsController {
  constructor(@Inject(RequestApplicationsService) private readonly service: RequestApplicationsService) {}

  @Post(':id/applications')
  @ApiOperation({ summary: '提交服务申请（PENDING；不创建订单）' })
  @ApiOkResponse({ description: 'ApplicationView' })
  async create(
    @CurrentUser() auth: AuthUser,
    @Param('id') requestId: string,
    @Body() dto: CreateApplicationDto,
  ): Promise<ApplicationView> {
    return this.service.create(requestId, auth.id, dto);
  }

  @Get(':id/applications')
  @ApiOperation({ summary: '查看本需求的申请列表（仅需求方）' })
  @ApiOkResponse({ description: 'ApplicationView[]' })
  async list(@CurrentUser() auth: AuthUser, @Param('id') requestId: string): Promise<ApplicationView[]> {
    return this.service.listByRequest(requestId, auth.id);
  }
}
