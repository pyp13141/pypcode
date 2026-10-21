import { BadRequestException, Controller, Delete, Get, Inject, NotFoundException, Param, Put } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { ERROR_CODES } from '../../../../common/error-codes';
import { PrismaService } from '../../../../prisma/prisma.service';

/**
 * GET/PUT/DELETE /api/v1/me/blocks[/:userId] — 契约：docs/modules/users/me-blocks.md
 * PUT/DELETE 幂等；禁屏蔽自己；屏蔽关系用于社区信息流过滤（M4 生效）。
 */
@ApiTags('users')
@Controller('me/blocks')
export class MeBlocksController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: '我的屏蔽列表' })
  async list(@CurrentUser() auth: AuthUser) {
    const rows = await this.prisma.userBlock.findMany({
      where: { blockerUserId: auth.id },
      include: { blocked: { select: { id: true, nickname: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((r) => ({ ...r.blocked, blockedAt: r.createdAt.toISOString() }));
  }

  @Put(':userId')
  @ApiOperation({ summary: '屏蔽用户（幂等）' })
  @ApiOkResponse({ description: '重复屏蔽返回已屏蔽状态，不报错' })
  async block(@CurrentUser() auth: AuthUser, @Param('userId') userId: string) {
    if (userId === auth.id) {
      throw new BadRequestException({ code: ERROR_CODES.SELF_BLOCK_NOT_ALLOWED, message: '不能屏蔽自己' });
    }
    const target = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true },
    });
    if (!target) {
      throw new NotFoundException({ code: ERROR_CODES.BLOCK_TARGET_NOT_FOUND, message: '目标用户不存在' });
    }
    await this.prisma.userBlock.upsert({
      where: { blockerUserId_blockedUserId: { blockerUserId: auth.id, blockedUserId: userId } },
      create: { blockerUserId: auth.id, blockedUserId: userId },
      update: {},
    });
    return { blocked: true };
  }

  @Delete(':userId')
  @ApiOperation({ summary: '取消屏蔽（幂等）' })
  async unblock(@CurrentUser() auth: AuthUser, @Param('userId') userId: string) {
    await this.prisma.userBlock.deleteMany({
      where: { blockerUserId: auth.id, blockedUserId: userId },
    });
    return { blocked: false };
  }
}
