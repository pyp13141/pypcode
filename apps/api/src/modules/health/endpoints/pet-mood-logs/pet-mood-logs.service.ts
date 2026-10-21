import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ERROR_CODES } from '../../../../common/error-codes';
import { Paginated, paginate, parsePagination } from '../../../../common/pagination';
import { PrismaService } from '../../../../prisma/prisma.service';
import { MOOD_TAGS } from '../../health-state';

export interface CreateMoodLogInput {
  moodTags: string[];
  severity?: number;
  observedAt: string;
  notes?: string;
}

/** POST/GET /api/v1/pets/:petId/mood-logs — 契约：docs/modules/health/pet-mood-logs.md */
@Injectable()
export class PetMoodLogsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async requireOwnedPet(petId: string, userId: string) {
    const pet = await this.prisma.pet.findFirst({
      where: { id: petId, ownerUserId: userId, archivedAt: null },
      select: { id: true },
    });
    if (!pet) {
      throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '宠物档案不存在' });
    }
  }

  async create(petId: string, userId: string, input: CreateMoodLogInput) {
    await this.requireOwnedPet(petId, userId);
    const tags = [...new Set(input.moodTags)];
    if (tags.length < 1 || tags.length > 5 || tags.some((t) => !(MOOD_TAGS as readonly string[]).includes(t))) {
      throw new BadRequestException({
        code: ERROR_CODES.REQUEST_VALIDATION_FAILED,
        message: `moodTags 需为 1-5 个白名单标签：${MOOD_TAGS.join('/')}`,
      });
    }
    if (input.severity !== undefined && (!Number.isInteger(input.severity) || input.severity < 1 || input.severity > 5)) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: 'severity 需为 1-5 整数' });
    }
    const observedAt = new Date(input.observedAt);
    if (Number.isNaN(observedAt.getTime()) || observedAt.getTime() > Date.now() + 60_000) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: 'observedAt 不合法（不能晚于当前时间）' });
    }
    return this.prisma.petMoodLog.create({
      data: { petId, moodTags: tags, severity: input.severity ?? null, observedAt, notes: input.notes ?? null },
    });
  }

  async list(petId: string, userId: string, pageRaw?: string, pageSizeRaw?: string) {
    await this.requireOwnedPet(petId, userId);
    const { page, pageSize, skip, take } = parsePagination({ page: pageRaw, pageSize: pageSizeRaw });
    const where = { petId };
    const [total, rows] = await Promise.all([
      this.prisma.petMoodLog.count({ where }),
      this.prisma.petMoodLog.findMany({ where, orderBy: { observedAt: 'desc' }, skip, take }),
    ]);
    const items = rows.map((r) => ({
      id: r.id,
      moodTags: r.moodTags,
      severity: r.severity,
      observedAt: r.observedAt.toISOString(),
      notes: r.notes,
    }));
    return paginate(items, page, pageSize, total) as Paginated<(typeof items)[number]>;
  }
}
