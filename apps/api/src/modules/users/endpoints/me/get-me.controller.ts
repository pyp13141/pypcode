import { Controller, Get, Inject, NotFoundException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { ERROR_CODES } from '../../../../common/error-codes';
import { PrismaService } from '../../../../prisma/prisma.service';

export interface MeResult {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  bio: string | null;
  areaCode: string | null;
  phoneMasked: string | null;
  phoneVerified: boolean;
  emailMasked: string | null;
  emailVerified: boolean;
  privacySettings: Record<string, unknown>;
  createdAt: string;
}

/** GET /api/v1/me — 契约：docs/modules/users/me.md（字段白名单，绝无明文手机号/openid） */
@ApiTags('users')
@Controller('me')
export class GetMeController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: '当前用户资料（白名单字段）' })
  @ApiOkResponse({ description: '不含明文手机号与任何外部身份标识' })
  async execute(@CurrentUser() auth: AuthUser): Promise<MeResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: auth.id },
      include: { privateProfile: true },
    });
    if (!user || user.deletedAt) {
      throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '用户不存在' });
    }
    return {
      id: user.id,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      areaCode: user.areaCode,
      phoneMasked: user.privateProfile?.phoneMasked ?? null,
      phoneVerified: user.privateProfile?.phoneVerifiedAt != null,
      emailMasked: user.privateProfile?.emailMasked ?? null,
      emailVerified: user.privateProfile?.emailVerifiedAt != null,
      privacySettings: (user.privateProfile?.privacySettings as Record<string, unknown>) ?? {},
      createdAt: user.createdAt.toISOString(),
    };
  }
}
