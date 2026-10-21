import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { Paginated, paginate, parsePagination } from '../../../../common/pagination';
import { PrismaService } from '../../../../prisma/prisma.service';

class ListNotificationsParams {
  @IsOptional() @IsIn(['true', 'false']) unreadOnly?: string;
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() pageSize?: string;
}

/** GET /api/v1/notifications — 契约：docs/modules/notifications/notifications.md */
@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: '我的通知（?unreadOnly=true）' })
  @ApiOkResponse({ description: '分页：data 为 { id, type, payload, readAt, createdAt }[]' })
  async list(@CurrentUser() auth: AuthUser, @Query() query: ListNotificationsParams) {
    const { page, pageSize, skip, take } = parsePagination(query);
    const where = { userId: auth.id, ...(query.unreadOnly === 'true' ? { readAt: null } : {}) };
    const [total, rows] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
    ]);
    const items = rows.map((n) => ({
      id: n.id,
      type: n.type,
      payload: n.payloadJson,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    }));
    return paginate(items, page, pageSize, total) as Paginated<(typeof items)[number]>;
  }
}
