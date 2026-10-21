import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';
import { encryptSensitive, maskEmail } from '../../../../common/crypto/sensitive-crypto';
import { Public } from '../../../../common/decorators/public.decorator';
import { PrismaService } from '../../../../prisma/prisma.service';
import { AuthSharedService, SessionTokens } from '../../auth-shared.service';

class EmailLoginDto {
  @IsEmail({}, { message: '邮箱格式不正确' })
  @MaxLength(120)
  email!: string;
  @IsString() @Length(6, 6) code!: string;
}

/**
 * POST /api/v1/auth/email/login — 契约：docs/modules/identity/email-login.md
 * D-014：校验邮箱验证码 → identity(provider=EMAIL, subject=规范化邮箱) 查找/创建 → 建会话；
 * 同时把邮箱写进私密资料（AES-256-GCM 密文 + 掩码 + 验证时间），供「联系人验证」门槛使用。
 * 封禁用户拒绝（403 USER_BANNED，API §1.1）。
 */
@ApiTags('identity')
@Controller('auth/email')
export class PostEmailLoginController {
  constructor(
    @Inject(AuthSharedService) private readonly auth: AuthSharedService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  @Post('login')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: '邮箱验证码登录/注册（新邮箱自动建账号并标记已验证）' })
  @ApiOkResponse({ description: '{ accessToken, refreshToken, user, ... }（同微信登录）' })
  async login(@Body() dto: EmailLoginDto): Promise<SessionTokens & { user: { id: string; nickname: string } }> {
    const email = AuthSharedService.normalizeEmail(dto.email);
    this.auth.verifyEmailCode(email, dto.code);
    const { userId, isNew } = await this.auth.findOrCreateByIdentity('EMAIL', email);
    await this.prisma.userPrivateProfile.upsert({
      where: { userId },
      create: {
        userId,
        emailEncrypted: encryptSensitive(email),
        emailMasked: maskEmail(email),
        emailVerifiedAt: new Date(),
      },
      update: {
        emailEncrypted: encryptSensitive(email),
        emailMasked: maskEmail(email),
        emailVerifiedAt: new Date(),
      },
    });
    const tokens = await this.auth.createSession(userId);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, nickname: true } });
    void isNew;
    return { ...tokens, user };
  }
}
