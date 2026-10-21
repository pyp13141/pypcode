import { Controller, Get, HttpException, Inject, Param, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { verifyScopedToken } from '../../../../common/crypto/sensitive-crypto';
import { ERROR_CODES } from '../../../../common/error-codes';
import { Public } from '../../../../common/decorators/public.decorator';
import { PrismaService } from '../../../../prisma/prisma.service';
import { MediaStorageService } from '../../media-storage.service';

/**
 * GET /api/v1/media/:mediaId/file?expires=&token= — 契约：docs/modules/media/media-blob.md
 * 签名读取端点（短时 token；对象 key 不可预测且不经 URL 暴露）。
 */
@ApiTags('media')
@Controller('media')
export class MediaBlobFileController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MediaStorageService) private readonly storage: MediaStorageService,
  ) {}

  @Get(':mediaId/file')
  @Public()
  @ApiOperation({ summary: '读取媒体字节（短时签名 token 认证）' })
  async file(
    @Param('mediaId') mediaId: string,
    @Query('expires') expiresRaw: string,
    @Query('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    const expires = Number(expiresRaw);
    if (!verifyScopedToken('media', mediaId, 'read', expires, token ?? '')) {
      throw new HttpException({ code: ERROR_CODES.RESOURCE_FORBIDDEN, message: '读取签名无效或已过期' }, 403);
    }
    const media = await this.prisma.mediaAsset.findUnique({ where: { id: mediaId } });
    if (!media || media.moderationStatus === 'REJECTED' || !media.finalizedAt) {
      throw new HttpException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '媒体不存在' }, 404);
    }
    const { stream, size } = await this.storage.getObjectStream(media.objectKey);
    res.setHeader('Content-Type', media.mimeType ?? 'application/octet-stream');
    res.setHeader('Content-Length', String(size));
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    stream.pipe(res);
  }
}
