import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  db: 'ok' | 'error';
  uptimeSeconds: number;
}

/** GET /api/v1/health 的业务逻辑：数据库连通性探测 */
@Injectable()
export class GetHealthService {
  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<HealthStatus> {
    let db: 'ok' | 'error' = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      db = 'error';
    }
    return {
      status: db === 'ok' ? 'ok' : 'degraded',
      db,
      uptimeSeconds: Math.round(process.uptime()),
    };
  }
}
