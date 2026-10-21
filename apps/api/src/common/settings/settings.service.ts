import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const TTL_MS = 30_000;

/**
 * 运营配置（app_settings 键值表，D-013）：管理员可调，业务侧带缓存读取。
 * 已接线键：leaderboard-weights（榜单加权）、risk-rules.messagePerMinute（消息限流）。
 */
@Injectable()
export class SettingsService {
  private readonly cache = new Map<string, { value: unknown; at: number }>();

  constructor(private readonly prisma: PrismaService) {}

  async get<T>(key: string, fallback: T): Promise<T> {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.at < TTL_MS) return (cached.value as T) ?? fallback;
    const row = await this.prisma.appSetting.findUnique({ where: { key } });
    this.cache.set(key, { value: row?.valueJson ?? null, at: Date.now() });
    return (row?.valueJson as T) ?? fallback;
  }

  async set(key: string, value: unknown, updatedBy: string): Promise<void> {
    await this.prisma.appSetting.upsert({
      where: { key },
      create: { key, valueJson: value as Prisma.InputJsonValue, updatedBy },
      update: { valueJson: value as Prisma.InputJsonValue, updatedBy },
    });
    this.cache.delete(key);
  }
}
