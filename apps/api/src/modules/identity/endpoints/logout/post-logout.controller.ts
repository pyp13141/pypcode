import { Controller, HttpCode, Inject, Post, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthSharedService } from '../../auth-shared.service';

/** POST /api/v1/auth/logout — 契约：docs/modules/identity/logout.md */
@ApiTags('identity')
@Controller('auth/logout')
export class PostLogoutController {
  constructor(@Inject(AuthSharedService) private readonly auth: AuthSharedService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: '登出并撤销当前会话' })
  @ApiOkResponse({ description: '幂等：重复登出同样返回成功' })
  async execute(@Req() req: Request): Promise<{ loggedOut: true }> {
    const header = req.header('authorization') ?? '';
    await this.auth.logoutByAccessToken(header.startsWith('Bearer ') ? header.slice(7) : '');
    return { loggedOut: true };
  }
}
