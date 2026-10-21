import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ERROR_CODES } from '../../../../common/error-codes';
import { SettingsService } from '../../../../common/settings/settings.service';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { AdminAuditService } from '../../admin-audit.service';

const DEFAULT_LEADERBOARD_CONFIG = {
  boards: ['contribution', 'content', 'growth'],
  weights: { like: 2, favorite: 3, comment: 2 },
};
const DEFAULT_RISK_RULES = {
  messagePerMinute: 10,
  requirePhoneVerified: false,
  newProviderDailyOrderLimit: 3,
};

/** 后台配置（API §6 配置组） — 契约：docs/modules/report-admin/admin-config.md */
@Injectable()
export class AdminConfigService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SettingsService) private readonly settings: SettingsService,
    @Inject(AdminAuditService) private readonly audit: AdminAuditService,
  ) {}

  async listCategories() {
    const rows = await this.prisma.marketCategory.findMany({ orderBy: { sort: 'asc' }, include: { _count: { select: { listings: true } } } });
    return rows.map((c) => ({
      code: c.code,
      name: c.name,
      riskLevel: c.riskLevel,
      status: c.status,
      sort: c.sort,
      listingCount: c._count.listings,
    }));
  }

  async updateCategory(adminUserId: string, code: string, input: { name?: string; riskLevel?: string; status?: string }, requestId?: string) {
    if (input.riskLevel && !['LOW', 'MEDIUM', 'HIGH'].includes(input.riskLevel)) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: 'riskLevel 需为 LOW/MEDIUM/HIGH' });
    }
    if (input.status && !['ACTIVE', 'DISABLED'].includes(input.status)) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: 'status 需为 ACTIVE/DISABLED' });
    }
    const category = await this.prisma.marketCategory.findUnique({ where: { code } });
    if (!category) throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '分类不存在' });
    const updated = await this.prisma.marketCategory.update({
      where: { code },
      data: { ...(input.name ? { name: input.name } : {}), ...(input.riskLevel ? { riskLevel: input.riskLevel } : {}), ...(input.status ? { status: input.status } : {}) },
    });
    await this.audit.record({ adminUserId, action: 'CATEGORY_UPDATE', resourceType: 'CATEGORY', resourceId: category.id, requestId, detail: input });
    return { code: updated.code, name: updated.name, riskLevel: updated.riskLevel, status: updated.status };
  }

  async listBadges() {
    const rows = await this.prisma.badge.findMany({ orderBy: { code: 'asc' }, include: { _count: { select: { userBadges: true } } } });
    return rows.map((b) => ({ code: b.code, name: b.name, rule: b.ruleJson, isActive: b.isActive, earnedCount: b._count.userBadges }));
  }

  async upsertBadge(adminUserId: string, code: string, input: { name?: string; ruleJson?: Record<string, unknown>; isActive?: boolean }, requestId?: string) {
    const badge = await this.prisma.badge.upsert({
      where: { code },
      create: {
        code,
        name: input.name ?? code,
        ruleJson: (input.ruleJson ?? {}) as Prisma.InputJsonValue,
        isActive: input.isActive ?? true,
      },
      update: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.ruleJson ? { ruleJson: input.ruleJson as Prisma.InputJsonValue } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
    await this.audit.record({ adminUserId, action: 'BADGE_UPSERT', resourceType: 'BADGE', resourceId: badge.id, requestId, detail: { code } });
    return { code: badge.code, name: badge.name, rule: badge.ruleJson, isActive: badge.isActive };
  }

  async getLeaderboardConfig() {
    return this.settings.get('leaderboard-config', DEFAULT_LEADERBOARD_CONFIG);
  }

  async setLeaderboardConfig(adminUserId: string, value: Record<string, unknown>, requestId?: string) {
    await this.settings.set('leaderboard-config', value, adminUserId);
    await this.audit.record({ adminUserId, action: 'LEADERBOARD_CONFIG_UPDATE', resourceType: 'SETTING', resourceId: 'leaderboard-config', requestId, detail: value });
    return value;
  }

  async getRiskRules() {
    return this.settings.get('risk-rules', DEFAULT_RISK_RULES);
  }

  async setRiskRules(adminUserId: string, value: Record<string, unknown>, requestId?: string) {
    await this.settings.set('risk-rules', value, adminUserId);
    await this.audit.record({ adminUserId, action: 'RISK_RULES_UPDATE', resourceType: 'SETTING', resourceId: 'risk-rules', requestId, detail: value });
    return value;
  }
}
