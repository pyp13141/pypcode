import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminGuard } from './admin.guard';
import { AdminAuditService } from './admin-audit.service';
import { ReportsController } from './endpoints/reports/reports.controller';
import { ReportsService } from './endpoints/reports/reports.service';
import { MyReportsController } from './endpoints/my-reports/my-reports.controller';
import { AdminUsersController } from './endpoints/admin-users/admin-users.controller';
import { AdminUsersService } from './endpoints/admin-users/admin-users.service';
import { AdminModerationController } from './endpoints/admin-moderation/admin-moderation.controller';
import { AdminModerationService } from './endpoints/admin-moderation/admin-moderation.service';
import { AdminReportsController } from './endpoints/admin-reports/admin-reports.controller';
import { AdminDisputesController } from './endpoints/admin-disputes/admin-disputes.controller';
import { AdminDisputesService } from './endpoints/admin-disputes/admin-disputes.service';
import { AdminRecordsController } from './endpoints/admin-records/admin-records.controller';
import { AdminConfigController } from './endpoints/admin-config/admin-config.controller';
import { AdminConfigService } from './endpoints/admin-config/admin-config.service';
import { AdminMetricsController } from './endpoints/admin-metrics/admin-metrics.controller';
import { AdminAuditController } from './endpoints/admin-audit/admin-audit.controller';

/**
 * 治理模块（M4）：内容举报 + 后台（11.6 五角色最小权限，AdminGuard + @AdminRoles）。
 * 契约总览 docs/modules/moderation.md 与 docs/modules/report-admin/*。
 * 硬规则：所有后台写操作写 admin_audit_logs（追加式）；私密地址/紧急联系人默认不可见。
 */
@Module({
  imports: [NotificationsModule],
  controllers: [
    ReportsController,
    MyReportsController,
    AdminUsersController,
    AdminModerationController,
    AdminReportsController,
    AdminDisputesController,
    AdminRecordsController,
    AdminConfigController,
    AdminMetricsController,
    AdminAuditController,
  ],
  providers: [
    ReportsService,
    AdminUsersService,
    AdminModerationService,
    AdminDisputesService,
    AdminConfigService,
    AdminAuditService,
    AdminGuard,
  ],
  exports: [ReportsService, AdminAuditService],
})
export class ModerationModule {}
