import { Body, Controller, Inject, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsInt, Max, Min } from 'class-validator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { MEDIA_PURPOSES } from '../../media-state';
import { UploadAuthorization, UploadAuthorizationsService } from './upload-authorizations.service';

class AuthorizeDto {
  @IsIn(MEDIA_PURPOSES as unknown as string[]) purpose!: string;
  @IsInt() @Min(1) @Max(9) count!: number;
}

/**
 * POST /api/v1/media/upload-authorizations — 契约：docs/modules/media/upload-authorizations.md
 * 返回短时签名直传地址（对象存储私有桶直传形状；MVP 本地盘适配器同形状，D-007）。
 */
@ApiTags('media')
@Controller('media')
export class UploadAuthorizationsController {
  constructor(@Inject(UploadAuthorizationsService) private readonly service: UploadAuthorizationsService) {}

  @Post('upload-authorizations')
  @ApiOperation({ summary: '申请上传授权（服务端下发类型/大小限制与短时直传地址）' })
  @ApiOkResponse({ description: '{ uploads: [{ mediaId, uploadPath, uploadUrl, headers, expiresAt }] }' })
  async authorize(@CurrentUser() auth: AuthUser, @Body() dto: AuthorizeDto): Promise<UploadAuthorization[]> {
    const uploads = await this.service.authorize(auth.id, dto.purpose, dto.count);
    return uploads;
  }
}
