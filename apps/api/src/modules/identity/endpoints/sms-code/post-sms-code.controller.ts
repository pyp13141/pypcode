import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import { Public } from '../../../../common/decorators/public.decorator';
import { AuthSharedService } from '../../auth-shared.service';

class SendSmsCodeDto {
  @IsString()
  @Matches(/^1[3-9]\d{9}$/)
  phone!: string;
}

/** POST /api/v1/auth/sms/send-code — 契约：docs/modules/identity/sms-code.md */
@ApiTags('identity')
@Controller('auth/sms')
export class PostSmsCodeController {
  constructor(@Inject(AuthSharedService) private readonly auth: AuthSharedService) {}

  @Post('send-code')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: '发送短信验证码（Mock 供应商：码打日志，见 D-006）' })
  @ApiOkResponse({ description: '固定返回；不泄露手机号是否已注册' })
  async execute(@Body() dto: SendSmsCodeDto): Promise<{ expiresInMinutes: number }> {
    return this.auth.sendSmsCode(dto.phone);
  }
}
