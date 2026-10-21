import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';
import { Public } from '../../../../common/decorators/public.decorator';
import { AuthSharedService, SessionTokens } from '../../auth-shared.service';

class RefreshDto {
  @IsString()
  @IsNotEmpty()
  @Length(10, 512)
  refreshToken!: string;
}

/** POST /api/v1/auth/refresh — 契约：docs/modules/identity/refresh.md */
@ApiTags('identity')
@Controller('auth/refresh')
export class PostRefreshController {
  constructor(@Inject(AuthSharedService) private readonly auth: AuthSharedService) {}

  @Post()
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: '刷新会话（轮换；复用已撤销令牌触发全会话撤销）' })
  @ApiOkResponse({ description: '返回新令牌对' })
  execute(@Body() dto: RefreshDto): Promise<SessionTokens> {
    return this.auth.refresh(dto.refreshToken);
  }
}
