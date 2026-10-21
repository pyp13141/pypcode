import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type SensitiveResourceType = 'CARE_ORDER' | 'MEDIA' | 'PROFILE';
export type SensitiveFieldGroup = 'ADDRESS' | 'PHONE' | 'EVIDENCE' | 'EMERGENCY_CONTACT';

/**
 * 敏感字段访问审计（ERD 不变量 6 / D-008）：
 * 每次读取或写入敏感字段（地址/门禁/紧急联系人/手机号/履约证据）**必须**写一行；
 * 写入失败即让请求失败（审计不可丢），不做静默降级。
 */
@Injectable()
export class SensitiveAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    actorUserId: string;
    resourceType: SensitiveResourceType;
    resourceId: string;
    fieldGroups: SensitiveFieldGroup[];
    purpose: string;
    requestId?: string;
  }): Promise<void> {
    const groups = [...new Set(params.fieldGroups)];
    if (groups.length === 0) return;
    await this.prisma.sensitiveAccessLog.createMany({
      data: groups.map((fieldGroup) => ({
        actorUserId: params.actorUserId,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        fieldGroup,
        purpose: params.purpose,
        requestId: params.requestId ?? null,
      })),
    });
  }
}
