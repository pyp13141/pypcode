import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ERROR_CODES } from '../../../../common/error-codes';
import { SensitiveAccessService } from '../../../../common/audit/sensitive-access.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CareOrdersService } from '../../care-orders.service';
import { VISIT_TRANSITIONS } from '../../care-state';
import { VisitView, toVisitView } from '../../care-view';

export interface PatchVisitInput {
  action: 'START' | 'COMPLETE' | 'EXCEPTION' | 'MISSED' | 'CANCEL';
  notes?: string;
  evidence?: { evidenceType: 'NOTE' | 'PHOTO'; note?: string }[];
  requestId?: string;
}

const ACTION_TO_STATUS: Record<PatchVisitInput['action'], string> = {
  START: 'IN_PROGRESS',
  COMPLETE: 'COMPLETED',
  EXCEPTION: 'EXCEPTION',
  MISSED: 'MISSED',
  CANCEL: 'CANCELLED',
};

/**
 * PATCH /api/v1/care/orders/:id/visits/:visitId — 契约：docs/modules/care/order-visit-by-id.md
 * 仅服务者；开始/完成/异常（EXCEPTION/MISSED/CANCELLED 必填说明）；可附 NOTE 型履约凭证。
 * PHOTO 凭证随 M4 上传管线（D-011 #9）。
 */
@Injectable()
export class OrderVisitByIdService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CareOrdersService) private readonly orders: CareOrdersService,
    @Inject(SensitiveAccessService) private readonly audit: SensitiveAccessService,
  ) {}

  async patch(orderId: string, visitId: string, userId: string, input: PatchVisitInput): Promise<VisitView> {
    const { role } = await this.orders.getOrderForParticipant(orderId, userId);
    if (role !== 'PROVIDER') {
      throw new ConflictException({ code: ERROR_CODES.VISIT_STATE_INVALID, message: '只有服务者可以更新上门记录' });
    }
    const targetStatus = ACTION_TO_STATUS[input.action];
    if (!targetStatus) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: 'action 不合法' });
    }
    if (['EXCEPTION', 'MISSED', 'CANCEL'].includes(input.action) && !input.notes?.trim()) {
      throw new BadRequestException({
        code: ERROR_CODES.REQUEST_VALIDATION_FAILED,
        message: '异常/未完成/取消必须填写说明（notes）',
      });
    }
    for (const item of input.evidence ?? []) {
      if (item.evidenceType === 'PHOTO') {
        throw new BadRequestException({
          code: ERROR_CODES.REQUEST_VALIDATION_FAILED,
          message: 'PHOTO 凭证依赖媒体上传管线（M4）；当前支持 NOTE 文本凭证',
        });
      }
      if (!item.note?.trim()) {
        throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: 'NOTE 凭证必须提供 note 文本' });
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const order = await tx.careOrder.findUniqueOrThrow({ where: { id: orderId } });
      if (order.status !== 'IN_PROGRESS') {
        throw new ConflictException({
          code: ERROR_CODES.ORDER_STATE_INVALID,
          message: `订单状态 ${order.status} 不可更新上门记录（需 IN_PROGRESS）`,
        });
      }
      const visit = await tx.careVisit.findUnique({ where: { id: visitId } });
      if (!visit || visit.careOrderId !== orderId) {
        throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '上门记录不存在' });
      }
      if (!(VISIT_TRANSITIONS[visit.status] ?? []).includes(targetStatus)) {
        throw new ConflictException({
          code: ERROR_CODES.VISIT_STATE_INVALID,
          message: `上门记录状态 ${visit.status} 不允许流转到 ${targetStatus}`,
        });
      }
      const now = new Date();
      const result = await tx.careVisit.update({
        where: { id: visitId },
        data: {
          status: targetStatus,
          ...(input.action === 'START' ? { startedAt: now } : {}),
          ...(input.action === 'COMPLETE' ? { completedAt: now } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        },
      });
      for (const item of input.evidence ?? []) {
        await tx.careEvidence.create({
          data: {
            careVisitId: visitId,
            evidenceType: item.evidenceType,
            note: item.note ?? null,
            createdBy: userId,
          },
        });
      }
      return result;
    });

    if (input.evidence?.length) {
      await this.audit.log({
        actorUserId: userId,
        resourceType: 'CARE_ORDER',
        resourceId: orderId,
        fieldGroups: ['EVIDENCE'],
        purpose: 'CARE_EVIDENCE_WRITE',
        requestId: input.requestId,
      });
    }
    return toVisitView(updated);
  }
}
