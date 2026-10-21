import { Controller, Inject, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { MediaFinalizeService, MediaFinalizeView } from './media-finalize.service';

/** POST /api/v1/media/:mediaId/finalize — 契约：docs/modules/media/media-finalize.md */
@ApiTags('media')
@Controller('media')
export class MediaFinalizeController {
  constructor(@Inject(MediaFinalizeService) private readonly service: MediaFinalizeService) {}

  @Post(':mediaId/finalize')
  @ApiOperation({ summary: '登记上传结果（大小/类型/对象 key → PENDING 审核态）' })
  @ApiOkResponse({ description: 'MediaFinalizeView' })
  async finalize(@CurrentUser() auth: AuthUser, @Param('mediaId') mediaId: string): Promise<MediaFinalizeView> {
    return this.service.finalize(mediaId, auth.id);
  }
}
