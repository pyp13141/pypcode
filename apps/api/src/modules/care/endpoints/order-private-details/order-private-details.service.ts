import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { SensitiveAccessService, SensitiveFieldGroup } from '../../../../common/audit/sensitive-access.service';
import { decryptSensitive, encryptSensitive } from '../../../../common/crypto/sensitive-crypto';
import { ERROR_CODES } from '../../../../common/error-codes';
import { PrismaService } from '../../../../prisma/prisma.service';
import { PRIVATE_DETAILS_READABLE_STATUSES, PRIVATE_DETAILS_WRITABLE_STATUSES } from '../../care-state';

export interface PrivateDetailsView {
  address: string | null;
  entryInstructions: string | null;
  emergencyContact: string | null;
  accessPolicy: unknown;
  updatedAt: string | null;
}

export interface PutPrivateDetailsInput {
  address: string;
  entryInstructions?: string;
  emergencyContact?: string;
  requestId?: string;
}

/**
 * GET/PUT /api/v1/care/orders/:id/private-details ⭐敏感 — 契约：docs/modules/care/order-private-details.md
 *
 * 唯一读写路径（ERD 不变量 6）：
 * - 读：参与方 且 订单状态 ∈ {CONFIRMED, IN_PROGRESS, COMPLETION_SUBMITTED}，否则 403 PRIVATE_DETAIL_NOT_AVAILABLE；
 * - 写：仅需求方，订单 ∈ {PENDING_CONFIRMATION, CONFIRMED}（D-011 补口）；
 * - **每次读写都写 sensitive_access_logs**（字段组粒度；审计写入失败即请求失败）。
 * 密文只在本服务内解密，绝不经通用订单查询返回。
 */
@Injectable()
export class OrderPrivateDetailsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SensitiveAccessService) private readonly audit: SensitiveAccessService,
  ) {}

  async get(orderId: string, userId: string, requestId?: string): Promise<PrivateDetailsView> {
    const order = await this.prisma.careOrder.findUnique({
      where: { id: orderId },
      select: { id: true, requesterUserId: true, providerUserId: true, status: true },
    });
    const isParticipant = order !== null && (order.requesterUserId === userId || order.providerUserId === userId);
    const readable =
      isParticipant && (PRIVATE_DETAILS_READABLE_STATUSES as readonly string[]).includes(order!.status);
    if (!readable) {
      throw new ForbiddenException({
        code: ERROR_CODES.PRIVATE_DETAIL_NOT_AVAILABLE,
        message: '私密履约信息在当前状态不可读取（需为参与方且订单已确认）',
      });
    }

    const row = await this.prisma.careOrderPrivateDetail.findUnique({ where: { careOrderId: orderId } });
    const view = this.decryptRow(row);

    // 每次读取必写审计：按实际返回的非空字段组记录
    const groups: SensitiveFieldGroup[] = [];
    if (view.address !== null || view.entryInstructions !== null) groups.push('ADDRESS');
    if (view.emergencyContact !== null) groups.push('EMERGENCY_CONTACT');
    await this.audit.log({
      actorUserId: userId,
      resourceType: 'CARE_ORDER',
      resourceId: orderId,
      fieldGroups: groups,
      purpose: 'ORDER_PRIVATE_DETAILS_READ',
      requestId,
    });
    return view;
  }

  async put(orderId: string, userId: string, input: PutPrivateDetailsInput): Promise<PrivateDetailsView> {
    const order = await this.prisma.careOrder.findUnique({
      where: { id: orderId },
      select: { id: true, requesterUserId: true, status: true },
    });
    if (!order || order.requesterUserId !== userId) {
      // 非需求方：不泄露订单存在性（与订单详情一致用 403 会暴露参与关系；这里沿用私有路径的 403 语义）
      throw new ForbiddenException({
        code: ERROR_CODES.PRIVATE_DETAIL_NOT_AVAILABLE,
        message: '仅需求方可以维护私密履约信息',
      });
    }
    if (!(PRIVATE_DETAILS_WRITABLE_STATUSES as readonly string[]).includes(order.status)) {
      throw new ConflictException({
        code: ERROR_CODES.ORDER_STATE_INVALID,
        message: `订单状态 ${order.status} 不可修改私密履约信息`,
      });
    }
    const address = input.address?.trim();
    if (!address || address.length > 300) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: 'address 必填且不超过 300 字' });
    }
    if (input.entryInstructions && input.entryInstructions.length > 500) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: 'entryInstructions 不超过 500 字' });
    }
    if (input.emergencyContact && input.emergencyContact.length > 200) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: 'emergencyContact 不超过 200 字' });
    }

    const existing = await this.prisma.careOrderPrivateDetail.findUnique({ where: { careOrderId: orderId } });
    const data = {
      addressEncrypted: encryptSensitive(address),
      entryInstructionsEncrypted: input.entryInstructions
        ? encryptSensitive(input.entryInstructions)
        : (existing?.entryInstructionsEncrypted ?? null),
      emergencyContactEncrypted: input.emergencyContact
        ? encryptSensitive(input.emergencyContact)
        : (existing?.emergencyContactEncrypted ?? null),
      accessPolicy: { readableStatuses: [...PRIVATE_DETAILS_READABLE_STATUSES] },
    };
    const row = await this.prisma.careOrderPrivateDetail.upsert({
      where: { careOrderId: orderId },
      create: { careOrderId: orderId, ...data },
      update: data,
    });

    const groups: SensitiveFieldGroup[] = ['ADDRESS'];
    if (row.emergencyContactEncrypted) groups.push('EMERGENCY_CONTACT');
    await this.audit.log({
      actorUserId: userId,
      resourceType: 'CARE_ORDER',
      resourceId: orderId,
      fieldGroups: groups,
      purpose: 'ORDER_PRIVATE_DETAILS_WRITE',
      requestId: input.requestId,
    });
    return this.decryptRow(row);
  }

  private decryptRow(
    row: {
      addressEncrypted: string | null;
      entryInstructionsEncrypted: string | null;
      emergencyContactEncrypted: string | null;
      accessPolicy: unknown;
      updatedAt: Date;
    } | null,
  ): PrivateDetailsView {
    if (!row) {
      return { address: null, entryInstructions: null, emergencyContact: null, accessPolicy: {}, updatedAt: null };
    }
    return {
      address: row.addressEncrypted ? decryptSensitive(row.addressEncrypted) : null,
      entryInstructions: row.entryInstructionsEncrypted ? decryptSensitive(row.entryInstructionsEncrypted) : null,
      emergencyContact: row.emergencyContactEncrypted ? decryptSensitive(row.emergencyContactEncrypted) : null,
      accessPolicy: row.accessPolicy,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
