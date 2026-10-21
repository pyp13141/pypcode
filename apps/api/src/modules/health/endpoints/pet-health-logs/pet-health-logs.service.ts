import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ERROR_CODES } from '../../../../common/error-codes';
import { Paginated, paginate, parsePagination } from '../../../../common/pagination';
import { PrismaService } from '../../../../prisma/prisma.service';
import { HEALTH_LOG_TYPES, HEALTH_SOURCES } from '../../health-state';

export interface CreateHealthLogInput {
  logType: string;
  valueNum?: number;
  unit?: string;
  recordedAt: string;
  source?: string;
  notes?: string;
}

/** POST/GET /api/v1/pets/:petId/health-logs — 契约：docs/modules/health/pet-health-logs.md */
@Injectable()
export class PetHealthLogsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async requireOwnedPet(petId: string, userId: string) {
    const pet = await this.prisma.pet.findFirst({
      where: { id: petId, ownerUserId: userId, archivedAt: null },
      select: { id: true },
    });
    if (!pet) {
      // 非主人与不存在一律 404（不泄露存在性；参与方授权查看随订单照料卡片二期）
      throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '宠物档案不存在' });
    }
  }

  async create(petId: string, userId: string, input: CreateHealthLogInput) {
    await this.requireOwnedPet(petId, userId);
    if (!(HEALTH_LOG_TYPES as readonly string[]).includes(input.logType)) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: `logType 需为 ${HEALTH_LOG_TYPES.join('/')}` });
    }
    const source = input.source ?? 'MANUAL';
    if (!(HEALTH_SOURCES as readonly string[]).includes(source)) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: `source 需为 ${HEALTH_SOURCES.join('/')}` });
    }
    const recordedAt = new Date(input.recordedAt);
    if (Number.isNaN(recordedAt.getTime())) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: 'recordedAt 时间格式不正确' });
    }
    if (recordedAt.getTime() > Date.now() + 60_000) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: '记录时间不能晚于当前时间' });
    }
    if (input.valueNum !== undefined && (!Number.isFinite(input.valueNum) || input.valueNum <= 0)) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: 'valueNum 需为大于 0 的数值' });
    }
    return this.prisma.petHealthLog.create({
      data: {
        petId,
        logType: input.logType,
        valueNum: input.valueNum ?? null,
        unit: input.unit ?? null,
        recordedAt,
        source,
        notes: input.notes ?? null,
      },
    });
  }

  async list(petId: string, userId: string, logType: string | undefined, pageRaw?: string, pageSizeRaw?: string) {
    await this.requireOwnedPet(petId, userId);
    if (logType && !(HEALTH_LOG_TYPES as readonly string[]).includes(logType)) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: 'logType 不合法' });
    }
    const { page, pageSize, skip, take } = parsePagination({ page: pageRaw, pageSize: pageSizeRaw });
    const where: Prisma.PetHealthLogWhereInput = { petId, ...(logType ? { logType } : {}) };
    const [total, rows] = await Promise.all([
      this.prisma.petHealthLog.count({ where }),
      this.prisma.petHealthLog.findMany({ where, orderBy: { recordedAt: 'desc' }, skip, take }),
    ]);
    const items = rows.map((r) => this.view(r));
    return paginate(items, page, pageSize, total) as Paginated<(typeof items)[number]>;
  }

  private view(r: {
    id: string;
    logType: string;
    valueNum: number | null;
    unit: string | null;
    recordedAt: Date;
    source: string;
    notes: string | null;
  }) {
    return {
      id: r.id,
      logType: r.logType,
      valueNum: r.valueNum,
      unit: r.unit,
      recordedAt: r.recordedAt.toISOString(),
      source: r.source,
      notes: r.notes,
    };
  }
}
