import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import { Public } from '../../../../common/decorators/public.decorator';
import { AuthSharedService } from '../../auth-shared.service';
import { LoginResult } from '../wechat-login/post-wechat-login.controller';

class H5LoginDto {
  @IsString()
  @Matches(/^1[3-9]\d{9}$/)
  phone!: string;

  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}

/** POST /api/v1/auth/h5/login — 契约：docs/modules/identity/h5-login.md */
@ApiTags('identity')
@Controller('auth/h5/login')
export class PostH5LoginController {
  constructor(@Inject(AuthSharedService) private readonly auth: AuthSharedService) {}

  @Post()
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'H5 手机号验证码登录' })
  @ApiOkResponse({ description: '返回会话令牌对与用户摘要' })
  async execute(@Body() dto: H5LoginDto): Promise<LoginResult> {
    this.auth.verifySmsCode(dto.phone, dto.code);
    const { userId } = await this.auth.findOrCreateByIdentity('H5_PHONE', dto.phone);
    const tokens = await this.auth.createSession(userId);
    const user = { id: userId, nickname: `宠邻用户${dto.phone.slice(-4)}`, avatarUrl: null };
    return { ...tokens, user };
  }
}
