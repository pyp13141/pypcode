import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createReadStream, promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';
import { ERROR_CODES } from '../../common/error-codes';

/**
 * 媒体存储适配器（D-007）：MVP 本地盘实现，接口按 S3 兼容形状设计
 * （putObject/getObject/deleteObject + 不可预测 objectKey）；
 * 上线前换腾讯云 COS 只替换本类实现，业务层不动。
 */
@Injectable()
export class MediaStorageService {
  private readonly logger = new Logger(MediaStorageService.name);
  private readonly root: string;

  constructor() {
    this.root = resolve(process.env.MEDIA_DIR ?? '/var/lib/petn-media');
  }

  /** 对象绝对路径（防路径穿越：objectKey 只允许 [a-z0-9-]） */
  private pathFor(objectKey: string): string {
    if (!/^[a-z0-9-]{8,64}$/.test(objectKey)) {
      throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '对象 key 非法' });
    }
    return join(this.root, objectKey);
  }

  async putObject(objectKey: string, data: Buffer): Promise<void> {
    await fs.mkdir(this.root, { recursive: true, mode: 0o750 });
    const tmp = `${this.pathFor(objectKey)}.tmp-${Date.now()}`;
    await fs.writeFile(tmp, data, { mode: 0o640 });
    await fs.rename(tmp, this.pathFor(objectKey));
  }

  async getObjectStream(objectKey: string): Promise<{ stream: NodeJS.ReadableStream; size: number }> {
    const path = this.pathFor(objectKey);
    const stat = await fs.stat(path).catch(() => null);
    if (!stat?.isFile()) {
      throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '媒体文件不存在（可能未完成上传）' });
    }
    return { stream: createReadStream(path), size: stat.size };
  }

  async exists(objectKey: string): Promise<boolean> {
    const stat = await fs.stat(this.pathFor(objectKey)).catch(() => null);
    return stat?.isFile() === true;
  }

  async deleteObject(objectKey: string): Promise<void> {
    await fs.unlink(this.pathFor(objectKey)).catch((error: unknown) => {
      this.logger.warn(`删除对象失败 ${objectKey}: ${String(error)}`);
    });
  }
}
