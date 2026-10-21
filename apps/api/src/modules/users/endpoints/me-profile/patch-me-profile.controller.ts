import { Body, Controller, Inject, Patch } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { PrismaService } from '../../../../prisma/prisma.service';

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(3, 20)
  nickname?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  areaCode?: string;
}

/** PATCH /api/v1/me/profile — 契约：docs/modules/users/me-profile.md */
@ApiTags('users')
@Controller('me/profile')
export class PatchMeProfileController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Patch()
  @ApiOperation({ summary: '更新本人资料（白名单字段）' })
  @ApiOkResponse({ description: '只更新传入字段；未传字段不动' })
  async execute(@CurrentUser() auth: AuthUser, @Body() dto: UpdateProfileDto) {
    const data: Record<string, string> = {};
    if (dto.nickname !== undefined) data.nickname = dto.nickname;
    if (dto.avatarUrl !== undefined) data.avatarUrl = dto.avatarUrl;
    if (dto.bio !== undefined) data.bio = dto.bio;
    if (dto.areaCode !== undefined) data.areaCode = dto.areaCode;

    const user = await this.prisma.user.update({ where: { id: auth.id }, data });
    return { id: user.id, nickname: user.nickname, avatarUrl: user.avatarUrl, bio: user.bio, areaCode: user.areaCode };
  }
}
