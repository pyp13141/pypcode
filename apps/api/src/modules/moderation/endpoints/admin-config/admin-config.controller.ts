import { Body, Controller, Get, HttpCode, Inject, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsObject, IsOptional, IsString, Length } from 'class-validator';
import { RequestId } from '../../../../common/decorators/request-id.decorator';
import { AdminGuard } from '../../admin.guard';
import { AdminRoles } from '../../admin-roles.decorator';
import { CurrentAdmin } from '../../current-admin.decorator';
import { AdminActor } from '../../admin.guard';
import { AdminConfigService } from './admin-config.service';

class UpdateCategoryDto {
  @IsOptional() @IsString() @Length(1, 40) name?: string;
  @IsOptional() @IsIn(['LOW', 'MEDIUM', 'HIGH']) riskLevel?: string;
  @IsOptional() @IsIn(['ACTIVE', 'DISABLED']) status?: string;
}

class UpsertBadgeDto {
  @IsOptional() @IsString() @Length(1, 40) name?: string;
  @IsOptional() @IsObject() ruleJson?: Record<string, unknown>;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class SettingsDto {
  @IsObject() value!: Record<string, unknown>;
}

/**
 * 后台配置（API §6） — 契约：docs/modules/report-admin/admin-config.md
 * 配置变更写审计；leaderboard-weights 与 risk-rules.messagePerMinute 已被业务侧读取（D-013）。
 */
@ApiTags('admin')
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminConfigController {
  constructor(@Inject(AdminConfigService) private readonly service: AdminConfigService) {}

  @Get('categories')
  @AdminRoles('catalog_operator')
  @ApiOperation({ summary: '类目列表' })
  async categories() {
    return this.service.listCategories();
  }

  @Put('categories/:code')
  @AdminRoles('catalog_operator')
  @ApiOperation({ summary: '更新类目（风险级/状态）' })
  async updateCategory(@CurrentAdmin() admin: AdminActor, @Param('code') code: string, @Body() dto: UpdateCategoryDto, @RequestId() requestId?: string) {
    return this.service.updateCategory(admin.userId, code, dto, requestId);
  }

  @Get('badges')
  @AdminRoles('catalog_operator')
  @ApiOperation({ summary: '徽章列表（含发放数）' })
  async badges() {
    return this.service.listBadges();
  }

  @Put('badges/:code')
  @AdminRoles('catalog_operator')
  @ApiOperation({ summary: '新增/更新徽章' })
  async upsertBadge(@CurrentAdmin() admin: AdminActor, @Param('code') code: string, @Body() dto: UpsertBadgeDto, @RequestId() requestId?: string) {
    return this.service.upsertBadge(admin.userId, code, dto, requestId);
  }

  @Get('leaderboard-config')
  @AdminRoles('super_admin', 'catalog_operator')
  @ApiOperation({ summary: '榜单配置' })
  async getLeaderboardConfig() {
    return this.service.getLeaderboardConfig();
  }

  @Put('leaderboard-config')
  @AdminRoles('super_admin')
  @ApiOperation({ summary: '更新榜单配置（高危）' })
  async setLeaderboardConfig(@CurrentAdmin() admin: AdminActor, @Body() dto: SettingsDto, @RequestId() requestId?: string) {
    return this.service.setLeaderboardConfig(admin.userId, dto.value, requestId);
  }

  @Get('risk-rules')
  @AdminRoles('super_admin', 'support_operator')
  @ApiOperation({ summary: '风控规则（新服务者接单上限等）' })
  async getRiskRules() {
    return this.service.getRiskRules();
  }

  @Put('risk-rules')
  @AdminRoles('super_admin')
  @ApiOperation({ summary: '更新风控规则（高危）' })
  async setRiskRules(@CurrentAdmin() admin: AdminActor, @Body() dto: SettingsDto, @RequestId() requestId?: string) {
    return this.service.setRiskRules(admin.userId, dto.value, requestId);
  }
}
