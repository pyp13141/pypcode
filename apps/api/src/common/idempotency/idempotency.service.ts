import { createHash } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ERROR_CODES } from '../error-codes';
import { PrismaService } from '../../prisma/prisma.service';

const TTL_MS = 24 * 60 * 60 * 1000; // 记录保留 24h（ERD：定期清理；重放窗口足够）
const POLL_INTERVAL_MS = 100;
const POLL_MAX_ATTEMPTS = 30; // 最长等 3s

export interface IdempotentResult<T> {
  /** 结果引用（orderId/visitId/reviewId...），重放时按它重读结果 */
  ref: string;
  data: T;
}

type Reservation =
  | { status: 'OWNED' }
  | { status: 'REPLAY'; ref: string }
  | { status: 'PENDING' };

/**
 * 幂等键执行器（docs/API.md §0；表结构 docs/ERD.md idempotency_records）。
 *
 * 协议：调用方先 requireKey() 取头，再 execute()：
 * 1. 首次请求：占位行（response_ref=null）→ 执行业务 → 回填 ref；
 * 2. 同 key 同请求体重复请求：按 ref 重读并返回同一结果（不重复建单）；
 * 3. 同 key 不同请求体：409 IDEMPOTENCY_KEY_CONFLICT；
 * 4. 同 key 并发：唯一约束保证只有一个执行者，另一方短轮询等待后重放；
 * 5. 业务失败：删除占位行，允许换新 key 重试（同 key 重试也允许，因为占位已删）。
 */
@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** 校验并返回 Idempotency-Key 头；缺失/非法 → 400 */
  requireKey(raw?: string | string[]): string {
    const key = Array.isArray(raw) ? raw[0] : raw;
    if (!key || key.trim().length < 8 || key.trim().length > 128) {
      throw new BadRequestException({
        code: ERROR_CODES.REQUEST_VALIDATION_FAILED,
        message: '缺少或不合法 Idempotency-Key 头（8-128 字符）',
      });
    }
    return key.trim();
  }

  /** 请求体哈希（同 key 不同体检测；键序无关） */
  hashBody(body: unknown): string {
    return createHash('sha256').update(stableStringify(body ?? null)).digest('hex');
  }

  async execute<T>(
    userId: string,
    key: string,
    requestHash: string,
    handler: () => Promise<IdempotentResult<T>>,
    replay: (ref: string) => Promise<T>,
  ): Promise<T> {
    const reservation = await this.reserve(userId, key, requestHash);
    if (reservation.status === 'REPLAY') return replay(reservation.ref);
    if (reservation.status === 'PENDING') {
      const ref = await this.pollForRef(userId, key);
      if (ref) return replay(ref);
      throw new ConflictException({
        code: ERROR_CODES.RESOURCE_CONFLICT,
        message: '相同幂等键的请求正在处理中，请稍后重试',
      });
    }

    try {
      const { ref, data } = await handler();
      await this.prisma.idempotencyRecord.update({
        where: { userId_idempotencyKey: { userId, idempotencyKey: key } },
        data: { responseStatus: 200, responseRef: ref },
      });
      return data;
    } catch (error) {
      // 业务失败：释放占位，允许重试（失败结果本身不做重放）
      await this.prisma.idempotencyRecord
        .deleteMany({ where: { userId, idempotencyKey: key, responseRef: null } })
        .catch((cleanupError: unknown) =>
          this.logger.warn(`幂等占位清理失败 key=${key}: ${String(cleanupError)}`),
        );
      throw error;
    }
  }

  private async reserve(userId: string, key: string, requestHash: string): Promise<Reservation> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const existing = await this.prisma.idempotencyRecord.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey: key } },
      });
      if (!existing) {
        try {
          await this.prisma.idempotencyRecord.create({
            data: {
              userId,
              idempotencyKey: key,
              requestHash,
              expiresAt: new Date(Date.now() + TTL_MS),
            },
          });
          return { status: 'OWNED' };
        } catch (error) {
          if (isUniqueViolation(error)) continue; // 并发同 key：转下一轮读取
          throw error;
        }
      }
      if (existing.requestHash !== requestHash) {
        throw new ConflictException({
          code: ERROR_CODES.IDEMPOTENCY_KEY_CONFLICT,
          message: '该 Idempotency-Key 已用于不同的请求体',
        });
      }
      if (existing.expiresAt.getTime() <= Date.now()) {
        await this.prisma.idempotencyRecord.deleteMany({ where: { id: existing.id } });
        continue;
      }
      if (existing.responseRef) return { status: 'REPLAY', ref: existing.responseRef };
      return { status: 'PENDING' };
    }
    // 两轮都在并发竞争：让调用方稍后重试（不阻塞请求线程）
    return { status: 'PENDING' };
  }

  private async pollForRef(userId: string, key: string): Promise<string | null> {
    for (let i = 0; i < POLL_MAX_ATTEMPTS; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      const row = await this.prisma.idempotencyRecord.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey: key } },
      });
      if (!row) return null; // 占位已被释放（首请求失败）
      if (row.responseRef) return row.responseRef;
    }
    return null;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/** 稳定序列化：对象键排序，保证同体不同键序哈希一致 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(',')}}`;
}
