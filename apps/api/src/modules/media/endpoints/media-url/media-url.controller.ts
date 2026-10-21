import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../../common/decorators/public.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { RequestId } from '../../../../common/decorators/request-id.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { MediaUrlService, MediaUrlView } from './media-url.service';

/**
 * GET /api/v1/media/:mediaId/url — 契约：docs/modules/media/media-url.md
 * 登录可选（公开媒体未登录也可读；EVIDENCE 需参与方登录）。
 */
@ApiTags('media')
@Controller('media')
export class MediaUrlController {
  constructor(@Inject(MediaUrlService) private readonly service: MediaUrlService) {}

  @Get(':mediaId/url')
  @Public()
  @ApiOperation({ summary: '换取短时读取签名地址（业务授权校验）' })
  async getUrl(
    @CurrentUser() auth: AuthUser | undefined,
    @Param('mediaId') mediaId: string,
    @RequestId() requestId?: string,
  ): Promise<MediaUrlView> {
    return this.service.issue(mediaId, auth?.id, requestId);
  }
}
