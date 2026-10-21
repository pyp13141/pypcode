import { Body, Controller, Inject, Patch } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { PrismaService } from '../../../../prisma/prisma.service';

class UpdatePrivacyDto {
  @IsIn(['PUBLIC', 'FOLLOWERS', 'PRIVATE'])
  profileVisibility!: 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';
}

/** PATCH /api/v1/me/privacy — 契约：docs/modules/users/me-privacy.md */
@ApiTags('users')
@Controller('me/privacy')
export class PatchMePrivacyController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Patch()
  @ApiOperation({ summary: '更新资料公开范围' })
  @ApiOkResponse({ description: '手机号任何设置下都不对外展示' })
  async execute(@CurrentUser() auth: AuthUser, @Body() dto: UpdatePrivacyDto) {
    const settings = { profileVisibility: dto.profileVisibility };
    await this.prisma.userPrivateProfile.upsert({
      where: { userId: auth.id },
      create: { userId: auth.id, privacySettings: settings },
      update: { privacySettings: settings },
    });
    return { privacySettings: settings };
  }
}
