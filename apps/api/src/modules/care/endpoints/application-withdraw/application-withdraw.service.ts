import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ERROR_CODES } from '../../../../common/error-codes';
import { PrismaService } from '../../../../prisma/prisma.service';
import { ApplicationView, toApplicationView } from '../../care-view';

/**
 * POST /api/v1/care/applications/:applicationId/withdraw — 契约：docs/modules/care/application-withdraw.md
 * 仅申请人；PENDING → WITHDRAWN（记 reason）。撤回后同一需求不可再次申请（UNIQUE(request_id, applicant_user_id)，ERD）。
 */
@Injectable()
export class ApplicationWithdrawService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async withdraw(applicationId: string, applicantUserId: string, reason?: string): Promise<ApplicationView> {
    const application = await this.prisma.careApplication.findUnique({
      where: { id: applicationId },
      include: { applicant: true },
    });
    if (!application || application.applicantUserId !== applicantUserId) {
      throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '申请不存在' });
    }
    if (application.status !== 'PENDING') {
      throw new ConflictException({
        code: ERROR_CODES.APPLICATION_STATE_INVALID,
        message: `申请状态为 ${application.status}，不可撤回`,
      });
    }
    const updated = await this.prisma.careApplication.update({
      where: { id: applicationId },
      data: { status: 'WITHDRAWN', decidedAt: new Date(), decisionNote: reason ?? null },
    });
    return toApplicationView(updated, application.applicant);
  }
}
