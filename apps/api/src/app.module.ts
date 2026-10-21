import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { RequestIdMiddleware } from './common/request-id.middleware';
import { AuthGuard } from './common/guards/auth.guard';
import { AuditModule } from './common/audit/audit.module';
import { BadgeAwardModule } from './common/badges/badge-award.module';
import { MailerModule } from './common/mailer/mailer.module';
import { SettingsModule } from './common/settings/settings.module';
import { IdempotencyModule } from './common/idempotency/idempotency.module';
import { SystemModule } from './modules/system/system.module';
import { IdentityModule } from './modules/identity/identity.module';
import { UsersModule } from './modules/users/users.module';
import { PetsModule } from './modules/pets/pets.module';
import { TransitModule } from './modules/transit/transit.module';
import { CareModule } from './modules/care/care.module';
import { MediaModule } from './modules/media/media.module';
import { MarketModule } from './modules/market/market.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { CommunityModule } from './modules/community/community.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { ModerationModule } from './modules/moderation/moderation.module';
import { HealthModule } from './modules/health/health.module';
import { PrismaModule } from './prisma/prisma.module';

/**
 * 根模块。业务模块都在 src/modules/ 下，一领域一目录；
 * 模块之间禁止互相 import 内部实现（docs/ARCHITECTURE.md 模块边界）。
 * AuthGuard 全局默认要登录，@Public() 显式豁免。
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuditModule,
    IdempotencyModule,
    SettingsModule,
    BadgeAwardModule,
    MailerModule,
    SystemModule,
    IdentityModule,
    UsersModule,
    PetsModule,
    TransitModule,
    CareModule,
    MediaModule,
    MarketModule,
    NotificationsModule,
    CommunityModule,
    MessagingModule,
    ModerationModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
