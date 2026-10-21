import Taro from '@tarojs/taro';
import type { PlatformAdapter } from '../types';

const STORAGE_PREFIX = 'petn.';

/** 小程序 API 域名：构建时用 TARO_APP_API_ORIGIN 注入；上线必须是已备案的 HTTPS 域名 */
const API_ORIGIN = process.env.TARO_APP_API_ORIGIN ?? 'http://127.0.0.1';

/** 微信小程序实现 */
export const weappAdapter: PlatformAdapter = {
  apiBase: () => `${API_ORIGIN}/petn/api/v1`,
  storage: {
    get: (key) => {
      try {
        const value = Taro.getStorageSync(STORAGE_PREFIX + key);
        return value === '' || value === undefined ? null : String(value);
      } catch {
        return null;
      }
    },
    set: (key, value) => void Taro.setStorageSync(STORAGE_PREFIX + key, value),
    remove: (key) => void Taro.removeStorageSync(STORAGE_PREFIX + key),
  },
  toast: {
    info: (message) => void Taro.showToast({ title: message, icon: 'none', duration: 2200 }),
    success: (message) => void Taro.showToast({ title: message, icon: 'success', duration: 1500 }),
    error: (message) => void Taro.showToast({ title: message, icon: 'none', duration: 2500 }),
  },
  modal: {
    confirm: async ({ title, content, confirmText }) =>
      new Promise((resolve) => {
        void Taro.showModal({
          title,
          content,
          confirmText: confirmText ?? '确定',
          success: (res) => resolve(Boolean(res.confirm)),
          fail: () => resolve(false),
        });
      }),
  },
  navigation: {
    to: (url) => void Taro.navigateTo({ url }),
    back: () => void Taro.navigateBack({ delta: 1 }),
    switchTab: (url) => void Taro.switchTab({ url }),
    openMapApp: (name, lat, lng) => {
      // 小程序内直接打开微信内置地图（D-009）
      void Taro.openLocation({ latitude: lat, longitude: lng, name, scale: 16 });
    },
  },
  share: {
    share: (title) => {
      void Taro.showToast({ title: `${title}｜点右上角「···」分享`, icon: 'none', duration: 2500 });
      // 页面级 onShareAppMessage 在需要分享的页面单独实现（小程序分享必须由页面事件触发）
    },
  },
  media: {
    chooseImageAsArrayBuffer: async (count) => {
      const res = await Taro.chooseImage({ count, sizeType: ['compressed'] });
      const fs = Taro.getFileSystemManager();
      const files: { data: ArrayBuffer; mime: string; name: string }[] = [];
      for (const filePath of res.tempFilePaths) {
        const base64 = fs.readFileSync(filePath, 'base64') as string;
        const binary = Taro.base64ToArrayBuffer(base64);
        const ext = (filePath.split('.').pop() ?? 'jpg').toLowerCase();
        files.push({
          data: binary,
          mime: ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg',
          name: filePath.split('/').pop() ?? 'image.jpg',
        });
      }
      return files;
    },
  },
};
