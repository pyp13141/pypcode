import { Module } from '@nestjs/common';
import { MediaStorageService } from './media-storage.service';
import { UploadAuthorizationsController } from './endpoints/upload-authorizations/upload-authorizations.controller';
import { UploadAuthorizationsService } from './endpoints/upload-authorizations/upload-authorizations.service';
import { MediaFinalizeController } from './endpoints/media-finalize/media-finalize.controller';
import { MediaFinalizeService } from './endpoints/media-finalize/media-finalize.service';
import { MediaUrlController } from './endpoints/media-url/media-url.controller';
import { MediaUrlService } from './endpoints/media-url/media-url.service';
import { MediaBlobUploadController } from './endpoints/media-blob/media-blob-upload.controller';
import { MediaBlobFileController } from './endpoints/media-blob/media-blob-file.controller';

/**
 * 媒体模块（D-007）：短时授权直传 + finalize 登记 + 签名读取。
 * MVP 本地盘适配器（MediaStorageService），上线前替换为腾讯云 COS 同形状实现。
 * 契约 docs/modules/media.md。
 */
@Module({
  controllers: [
    UploadAuthorizationsController,
    MediaFinalizeController,
    MediaUrlController,
    MediaBlobUploadController,
    MediaBlobFileController,
  ],
  providers: [MediaStorageService, UploadAuthorizationsService, MediaFinalizeService, MediaUrlService],
  exports: [MediaStorageService],
})
export class MediaModule {}
