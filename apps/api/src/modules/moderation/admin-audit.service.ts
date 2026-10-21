import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * 后台操作审计（11.6：高危操作二次确认+理由+审计；追加式表，触发器拒绝改删）。
 * 每次后台写操作必须调用 record()。
 */
@Injectable()
export class AdminAuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async record(params: {
    adminUserId: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    requestId?: string;
    reason?: string;
    detail?: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.adminAuditLog.create({
      data: {
        adminUserId: params.adminUserId,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId ?? null,
        requestId: params.requestId ?? null,
        reason: params.reason ?? null,
        detailJson: (params.detail ?? {}) as Prisma.InputJsonValue,
      },
    });
  }
}
