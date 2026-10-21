import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ERROR_CODES } from '../../../../common/error-codes';
import { Paginated, paginate, parsePagination } from '../../../../common/pagination';
import { PrismaService } from '../../../../prisma/prisma.service';
import { ORDER_STATUSES } from '../../care-state';
import { OrderView, toOrderView } from '../../care-view';

export interface ListOrdersQuery {
  role?: string;
  status?: string;
  page?: string;
  pageSize?: string;
}

/** GET /api/v1/care/orders — 契约：docs/modules/care/orders.md（仅参与方；按 role/status 过滤） */
@Injectable()
export class OrdersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(userId: string, query: ListOrdersQuery): Promise<Paginated<OrderView>> {
    const { page, pageSize, skip, take } = parsePagination(query);
    if (query.role && !['REQUESTER', 'PROVIDER'].includes(query.role)) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: 'role 需为 REQUESTER/PROVIDER' });
    }
    if (query.status && !(ORDER_STATUSES as readonly string[]).includes(query.status)) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: 'status 不合法' });
    }
    const where: Prisma.CareOrderWhereInput = {
      ...(query.role === 'REQUESTER'
        ? { requesterUserId: userId }
        : query.role === 'PROVIDER'
          ? { providerUserId: userId }
          : { OR: [{ requesterUserId: userId }, { providerUserId: userId }] }),
      ...(query.status ? { status: query.status } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.careOrder.count({ where }),
      this.prisma.careOrder.findMany({
        where,
        include: { requester: true, provider: true, privateDetail: { select: { careOrderId: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);
    const items = rows.map((row) =>
      toOrderView(row, userId, { hasPrivateDetails: row.privateDetail !== null }),
    );
    return paginate(items, page, pageSize, total);
  }
}
