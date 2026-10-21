import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ERROR_CODES } from '../../../../common/error-codes';
import { PrismaService } from '../../../../prisma/prisma.service';
import { ApplicationView, toApplicationView } from '../../care-view';

export interface CreateApplicationInput {
  message: string;
  proposedPriceMinor?: number;
}

/**
 * GET/POST /api/v1/care/requests/:id/applications — 契约：docs/modules/care/request-applications.md
 * POST：申请人≠需求方；同一 request+applicant 唯一（DB 约束，撤回/被拒后不可重复申请）。
 * GET：仅需求方可查看本需求的申请列表。
 */
@Injectable()
export class RequestApplicationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(requestId: string, applicantUserId: string, input: CreateApplicationInput): Promise<ApplicationView> {
    const request = await this.prisma.careRequest.findUnique({
      where: { id: requestId },
      select: { id: true, requesterUserId: true, status: true },
    });
    if (!request) {
      throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '需求不存在' });
    }
    if (request.requesterUserId === applicantUserId) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: '不能申请自己的需求' });
    }
    if (request.status !== 'PUBLISHED') {
      throw new ConflictException({ code: ERROR_CODES.REQUEST_NOT_OPEN, message: '需求已不处于可申请状态' });
    }
    if (input.proposedPriceMinor !== undefined && (!Number.isInteger(input.proposedPriceMinor) || input.proposedPriceMinor < 0)) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: 'proposedPriceMinor 必须为不小于 0 的整数分' });
    }

    try {
      const application = await this.prisma.careApplication.create({
        data: {
          requestId,
          applicantUserId,
          message: input.message,
          proposedPriceMinor: input.proposedPriceMinor === undefined ? null : BigInt(input.proposedPriceMinor),
          status: 'PENDING',
        },
        include: { applicant: true },
      });
      return toApplicationView(application, application.applicant);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({
          code: ERROR_CODES.RESOURCE_CONFLICT,
          message: '已对该需求提交过申请（同一需求同一人仅一份，撤回/被拒后不可重复申请）',
        });
      }
      throw error;
    }
  }

  async listByRequest(requestId: string, requesterUserId: string): Promise<ApplicationView[]> {
    const request = await this.prisma.careRequest.findUnique({
      where: { id: requestId },
      select: { requesterUserId: true },
    });
    if (!request || request.requesterUserId !== requesterUserId) {
      throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '需求不存在' });
    }
    const rows = await this.prisma.careApplication.findMany({
      where: { requestId },
      include: { applicant: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => toApplicationView(row, row.applicant));
  }
}
