import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { Public } from '../../../../common/decorators/public.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { PrismaService } from '../../../../prisma/prisma.service';

/**
 * GET /api/v1/badges — 契约：docs/modules/community/badges.md
 * 徽章定义与获取条件；登录后附带本人已获徽章。
 */
@ApiTags('community')
@Controller('badges')
export class BadgesController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: '徽章定义 + 本人已获徽章（未登录只有定义）' })
  @ApiOkResponse({ description: '{ definitions: [{code,name,rule}], earned: [{code,earnedAt}] }' })
  async list(@CurrentUser() auth: AuthUser | undefined) {
    const definitions = await this.prisma.badge.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } });
    const earned = auth
      ? await this.prisma.userBadge.findMany({
          where: { userId: auth.id },
          include: { badge: { select: { code: true } } },
          orderBy: { earnedAt: 'asc' },
        })
      : [];
    return {
      definitions: definitions.map((b) => ({ code: b.code, name: b.name, rule: b.ruleJson })),
      earned: earned.map((e) => ({ code: e.badge.code, earnedAt: e.earnedAt.toISOString(), metadata: e.metadataJson })),
    };
  }
}
