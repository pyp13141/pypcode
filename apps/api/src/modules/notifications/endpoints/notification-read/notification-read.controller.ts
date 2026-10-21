import { Controller, HttpCode, Inject, NotFoundException, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { ERROR_CODES } from '../../../../common/error-codes';
import { PrismaService } from '../../../../prisma/prisma.service';

/** POST /api/v1/notifications/:id/read — 契约：docs/modules/notifications/notification-read.md */
@ApiTags('notifications')
@Controller('notifications')
export class NotificationReadController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Post(':id/read')
  @HttpCode(200)
  @ApiOperation({ summary: '标记已读（本人；幂等）' })
  async read(@CurrentUser() auth: AuthUser, @Param('id') id: string): Promise<{ read: true }> {
    const existing = await this.prisma.notification.findUnique({ where: { id }, select: { userId: true, readAt: true } });
    if (!existing || existing.userId !== auth.id) {
      throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '通知不存在' });
    }
    if (!existing.readAt) {
      await this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
    }
    return { read: true };
  }
}
