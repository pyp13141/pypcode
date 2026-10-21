import Taro from '@tarojs/taro';
import type { PlatformAdapter } from '../types';

const STORAGE_PREFIX = 'petn.';

/** H5 实现：与 /petn/ 静态站点同源，API 走 /petn/api/v1（Caddy 反代） */
export const h5Adapter: PlatformAdapter = {
  // dev 与生产统一走相对路径 /petn/api/v1（生产=Caddy 反代；dev=webpack devServer 代理），远程浏览器同样可用
  apiBase: () => '/petn/api/v1',
  storage: {
    get: (key) => {
      try {
        return window.localStorage.getItem(STORAGE_PREFIX + key);
      } catch {
        return null;
      }
    },
    set: (key, value) => {
      try {
        window.localStorage.setItem(STORAGE_PREFIX + key, value);
      } catch {
        /* 隐私模式忽略 */
      }
    },
    remove: (key) => {
      try {
        window.localStorage.removeItem(STORAGE_PREFIX + key);
      } catch {
        /* ignore */
      }
    },
  },
  toast: {
    info: (message) => void Taro.showToast({ title: message, icon: 'none', duration: 2200 }),
    success: (message) => void Taro.showToast({ title: message, icon: 'success', duration: 1500 }),
    error: (message) => void Taro.showToast({ title: message, icon: 'error', duration: 2500 }),
  },
  modal: {
    confirm: async ({ title, content, confirmText }) => {
      return new Promise((resolve) => {
        void Taro.showModal({
          title,
          content,
          confirmText: confirmText ?? '确定',
          success: (res) => resolve(Boolean(res.confirm)),
          fail: () => resolve(false),
        });
      });
    },
  },
  navigation: {
    to: (url) => void Taro.navigateTo({ url }),
    back: () => void Taro.navigateBack({ delta: 1 }),
    switchTab: (url) => void Taro.switchTab({ url }),
    openMapApp: (name, lat, lng) => {
      // D-009：跳转手机本地地图 App（不接地图 API）
      window.open(`https://uri.amap.com/marker?position=${lng},${lat}&name=${encodeURIComponent(name)}`, '_blank');
    },
  },
  share: {
    share: async (title, path) => {
      const url = `${window.location.origin}${path}`;
      const nav = window.navigator as Navigator & { share?: (data: { title: string; url: string }) => Promise<void> };
      if (nav.share) {
        await nav.share({ title, url }).catch(() => undefined);
        return;
      }
      try {
        await navigator.clipboard.writeText(`${title} ${url}`);
        void Taro.showToast({ title: '链接已复制', icon: 'success' });
      } catch {
        window.prompt('复制链接', url);
      }
    },
  },
  media: {
    chooseImageAsArrayBuffer: async (count) => {
      const res = await Taro.chooseImage({ count, sizeType: ['compressed'] });
      const files: { data: ArrayBuffer; mime: string; name: string }[] = [];
      for (const filePath of res.tempFilePaths) {
        const response = await fetch(filePath);
        const blob = await response.blob();
        files.push({
          data: await blob.arrayBuffer(),
          mime: blob.type || 'image/jpeg',
          name: filePath.split('/').pop() ?? 'image.jpg',
        });
      }
      return files;
    },
  },
};
