import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { RequestId } from '../../../../common/decorators/request-id.decorator';
import { AdminGuard } from '../../admin.guard';
import { AdminRoles } from '../../admin-roles.decorator';
import { CurrentAdmin } from '../../current-admin.decorator';
import { AdminActor } from '../../admin.guard';
import { AdminUsersService } from './admin-users.service';

class ListUsersParams {
  @IsOptional() @IsString() @MaxLength(50) query?: string;
  @IsOptional() @IsIn(['ACTIVE', 'BANNED', 'DELETED']) status?: string;
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() pageSize?: string;
}

class SetStatusDto {
  @IsIn(['ACTIVE', 'BANNED']) status!: string;
  @IsString() @Length(2, 200) reason!: string;
}

/** GET /admin/users + POST /admin/users/:id/status — 契约：docs/modules/report-admin/admin-users.md */
@ApiTags('admin')
@Controller('admin/users')
@UseGuards(AdminGuard)
export class AdminUsersController {
  constructor(@Inject(AdminUsersService) private readonly service: AdminUsersService) {}

  @Get()
  @AdminRoles('content_moderator')
  @ApiOperation({ summary: '用户检索（含风险标签：被举报/被屏蔽计数）' })
  async list(@Query() query: ListUsersParams) {
    return this.service.list(query);
  }

  @Post(':id/status')
  @HttpCode(200)
  @AdminRoles('content_moderator')
  @ApiOperation({ summary: '封禁/解封（理由必填；封禁即撤销会话；写审计）' })
  async setStatus(
    @CurrentAdmin() admin: AdminActor,
    @Param('id') id: string,
    @Body() dto: SetStatusDto,
    @RequestId() requestId?: string,
  ) {
    return this.service.setStatus(admin.userId, id, dto.status, dto.reason, requestId);
  }
}
