import { Controller, HttpCode, Inject, NotFoundException, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { ERROR_CODES } from '../../../../common/error-codes';
import { PrismaService } from '../../../../prisma/prisma.service';

/**
 * POST /api/v1/community/help-posts/:id/cancel — 契约：docs/modules/community/help-post-cancel.md
 * 仅发帖人；OPEN → CLOSED（幂等：已 CLOSED 直接返回）。
 */
@ApiTags('community')
@Controller('community/help-posts')
export class HelpPostCancelController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: '关闭求助帖（仅发帖人；幂等）' })
  async cancel(@CurrentUser() auth: AuthUser, @Param('id') id: string): Promise<{ id: string; status: string }> {
    const row = await this.prisma.helpPost.findUnique({ where: { id }, select: { id: true, status: true, authorUserId: true } });
    if (!row || row.authorUserId !== auth.id) {
      throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '求助帖不存在' });
    }
    if (row.status === 'CLOSED') return { id: row.id, status: row.status };
    if (row.status !== 'OPEN') {
      throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: `求助帖状态为 ${row.status}，不可关闭` });
    }
    const updated = await this.prisma.helpPost.update({ where: { id }, data: { status: 'CLOSED' }, select: { id: true, status: true } });
    return updated;
  }
}
