import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';
import { createHash } from 'node:crypto';
import { Public } from '../../../../common/decorators/public.decorator';
import { AuthSharedService, SessionTokens } from '../../auth-shared.service';

class WechatLoginDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 128)
  code!: string;
}

export interface LoginResult extends SessionTokens {
  user: { id: string; nickname: string; avatarUrl: string | null };
}

/**
 * POST /api/v1/auth/wechat/login
 * 契约：docs/modules/identity/wechat-login.md
 * D-006：未配置 AppID 时 code 派生假 openid（开发 Mock）；生产未配置则启动失败（main.ts 校验）。
 */
@ApiTags('identity')
@Controller('auth/wechat/login')
export class PostWechatLoginController {
  constructor(
    @Inject(AuthSharedService) private readonly auth: AuthSharedService,
  ) {}

  @Post()
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: '微信小程序登录（开发环境 Mock 可切换，见 D-006）' })
  @ApiOkResponse({ description: '返回会话令牌对与用户摘要' })
  async execute(@Body() dto: WechatLoginDto): Promise<LoginResult> {
    const openid = await this.code2Session(dto.code);
    const { userId } = await this.auth.findOrCreateByIdentity('WECHAT_MINIPROGRAM', openid);
    const tokens = await this.auth.createSession(userId);
    return { ...tokens, user: { id: userId, nickname: '宠邻用户', avatarUrl: null } };
  }

  /** 配置了 WECHAT_APPID 时走真实 code2session；否则 Mock（生产启动时已拦截未配置场景） */
  private async code2Session(code: string): Promise<string> {
    const appid = process.env.WECHAT_APPID;
    const secret = process.env.WECHAT_APPSECRET;
    if (!appid || !secret) {
      return `mock_openid_${createHash('sha256').update(code).digest('hex').slice(0, 16)}`;
    }
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${code}&grant_type=authorization_code`;
    const res = await fetch(url);
    const data = (await res.json()) as { openid?: string; errcode?: number; errmsg?: string };
    if (!data.openid) {
      throw new Error(`微信 code2session 失败: ${data.errcode} ${data.errmsg}`);
    }
    return data.openid;
  }
}
