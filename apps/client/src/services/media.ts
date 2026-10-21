import Taro from '@tarojs/taro';
import { platform } from '../adapters';
import { api, auth } from './api-client';

export interface UploadedMedia {
  mediaId: string;
}

/**
 * 媒体上传（D-007 管线）：授权 → 直传 → finalize。
 * 平台差异（读取文件字节）在 adapters 里完成。
 */
export async function uploadImages(purpose: 'PET_AVATAR' | 'POST_IMAGE' | 'LISTING_IMAGE' | 'EVIDENCE', count: number): Promise<UploadedMedia[]> {
  const files = await platform.media.chooseImageAsArrayBuffer(count);
  if (files.length === 0) return [];
  const uploads = await api.post<{ mediaId: string; uploadPath: string }[]>('/media/upload-authorizations', {
    purpose,
    count: Math.min(files.length, count),
  });
  const results: UploadedMedia[] = [];
  for (let i = 0; i < uploads.length && i < files.length; i += 1) {
    const target = uploads[i];
    const file = files[i];
    const res = await Taro.request({
      url: `${platform.apiBase()}${target.uploadPath}`,
      method: 'PUT',
      data: file.data as never,
      header: { 'Content-Type': file.mime },
    });
    if (res.statusCode !== 200) {
      throw new Error(`图片上传失败（${res.statusCode}）`);
    }
    await api.post(`/media/${target.mediaId}/finalize`);
    results.push({ mediaId: target.mediaId });
  }
  return results;
}

/** 读取图片展示地址（业务授权校验后签发） */
export async function mediaUrl(mediaId: string): Promise<string> {
  const res = await api.get<{ url: string; path: string }>(`/media/${mediaId}/url`);
  const base = platform.apiBase().replace(/\/api\/v1$/, '');
  return res.url.startsWith('/') ? `${base}${res.path}` : res.url;
}
