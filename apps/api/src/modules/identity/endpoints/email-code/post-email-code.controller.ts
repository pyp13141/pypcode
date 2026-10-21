import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEmail, MaxLength } from 'class-validator';
import { Public } from '../../../../common/decorators/public.decorator';
import { AuthSharedService } from '../../auth-shared.service';

class SendEmailCodeDto {
  @IsEmail({}, { message: '邮箱格式不正确' })
  @MaxLength(120)
  email!: string;
}

/**
 * POST /api/v1/auth/email/send-code — 契约：docs/modules/identity/email-code.md
 * D-014：首期用邮箱验证码替代手机号（无短信供应商）。邮件为 Mock 供应商（验证码打日志）；
 * 限流 1 次/分钟/邮箱；验证码 5 分钟有效、最多 5 次尝试。
 */
@ApiTags('identity')
@Controller('auth/email')
export class PostEmailCodeController {
  constructor(@Inject(AuthSharedService) private readonly auth: AuthSharedService) {}

  @Post('send-code')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: '发送邮箱验证码（Mock 邮件供应商；生产接入真实供应商后同形状）' })
  @ApiOkResponse({ description: '{ expiresInMinutes: 5 }' })
  async send(@Body() dto: SendEmailCodeDto): Promise<{ expiresInMinutes: number }> {
    return this.auth.sendEmailCode(dto.email);
  }
}
