import { Controller, Headers, HttpException, Inject, Param, Put, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../../../common/decorators/public.decorator';
import { verifyScopedToken } from '../../../../common/crypto/sensitive-crypto';
import { ERROR_CODES } from '../../../../common/error-codes';
import { PrismaService } from '../../../../prisma/prisma.service';
import { MediaStorageService } from '../../media-storage.service';
import { MEDIA_PURPOSE_POLICY, isMediaPurpose } from '../../media-state';

/**
 * PUT /api/v1/media/:mediaId/upload?expires=&token= — 契约：docs/modules/media/media-blob.md
 * 直传端点：只认短时签名 token（非 Bearer）；校验大小上限与 MIME 白名单后落盘。
 * Content-Type 非 JSON，不经全局 body parser，直接读原始流。
 */
@ApiTags('media')
@Controller('media')
export class MediaBlobUploadController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MediaStorageService) private readonly storage: MediaStorageService,
  ) {}

  @Put(':mediaId/upload')
  @Public()
  @ApiOperation({ summary: '直传媒体字节（短时签名 token 认证）' })
  async upload(
    @Param('mediaId') mediaId: string,
    @Query('expires') expiresRaw: string,
    @Query('token') token: string,
    @Headers('content-type') contentType: string | undefined,
    @Req() req: Request,
  ): Promise<{ mediaId: string; sizeBytes: number; mimeType: string }> {
    const expires = Number(expiresRaw);
    if (!verifyScopedToken('media', mediaId, 'upload', expires, token ?? '')) {
      throw new HttpException({ code: ERROR_CODES.RESOURCE_FORBIDDEN, message: '上传授权无效或已过期' }, 403);
    }
    const media = await this.prisma.mediaAsset.findUnique({ where: { id: mediaId } });
    if (!media || !isMediaPurpose(media.purpose)) {
      throw new HttpException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '媒体对象不存在' }, 404);
    }
    if (media.finalizedAt) {
      throw new HttpException({ code: ERROR_CODES.RESOURCE_CONFLICT, message: '该媒体已完成上传登记，不可重复上传' }, 409);
    }
    const policy = MEDIA_PURPOSE_POLICY[media.purpose];
    const mime = (contentType ?? '').split(';')[0]!.trim().toLowerCase();
    if (!policy.mimeWhitelist.includes(mime)) {
      throw new HttpException(
        { code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: `不支持的类型（允许：${policy.mimeWhitelist.join(', ')}）` },
        400,
      );
    }

    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      const buf = chunk as Buffer;
      size += buf.length;
      if (size > policy.maxBytes) {
        throw new HttpException(
          { code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: `文件超过大小上限（${policy.maxBytes} 字节）` },
          413,
        );
      }
      chunks.push(buf);
    }
    if (size === 0) {
      throw new HttpException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: '上传内容为空' }, 400);
    }

    await this.storage.putObject(media.objectKey, Buffer.concat(chunks));
    await this.prisma.mediaAsset.update({
      where: { id: mediaId },
      data: { mimeType: mime, sizeBytes: BigInt(size) },
    });
    return { mediaId, sizeBytes: size, mimeType: mime };
  }
}
