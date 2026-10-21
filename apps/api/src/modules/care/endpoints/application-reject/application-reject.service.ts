import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ERROR_CODES } from '../../../../common/error-codes';
import { PrismaService } from '../../../../prisma/prisma.service';
import { ApplicationView, toApplicationView } from '../../care-view';

/**
 * POST /api/v1/care/applications/:applicationId/reject — 契约：docs/modules/care/application-reject.md
 * 仅需求方；PENDING → REJECTED（记 reason）。终态不可再变（STATE_MACHINES §3）。
 */
@Injectable()
export class ApplicationRejectService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async reject(applicationId: string, requesterUserId: string, reason?: string): Promise<ApplicationView> {
    const application = await this.prisma.careApplication.findUnique({
      where: { id: applicationId },
      include: { request: { select: { requesterUserId: true } }, applicant: true },
    });
    if (!application || application.request.requesterUserId !== requesterUserId) {
      throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '申请不存在' });
    }
    if (application.status !== 'PENDING') {
      throw new ConflictException({
        code: ERROR_CODES.APPLICATION_STATE_INVALID,
        message: `申请状态为 ${application.status}，不可拒绝`,
      });
    }
    const updated = await this.prisma.careApplication.update({
      where: { id: applicationId },
      data: { status: 'REJECTED', decidedAt: new Date(), decisionNote: reason ?? null },
    });
    return toApplicationView(updated, application.applicant);
  }
}
