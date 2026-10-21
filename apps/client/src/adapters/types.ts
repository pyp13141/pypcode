/**
 * 平台适配层接口（产品文档 14.2）：业务页面只依赖本接口，平台差异只允许出现在 adapters/。
 */
export interface StorageAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export interface ToastAdapter {
  info(message: string): void;
  success(message: string): void;
  error(message: string): void;
}

export interface ModalAdapter {
  confirm(options: { title: string; content: string; confirmText?: string }): Promise<boolean>;
}

export interface NavigationAdapter {
  to(url: string): void;
  back(): void;
  switchTab(url: string): void;
  /** 跳转本地地图 App 深链（D-009 最后一公里；服务器零成本） */
  openMapApp(name: string, lat: number, lng: number): void;
}

export interface ShareAdapter {
  /** 分享/复制链接（小程序端引导右上角菜单；H5 用系统分享或复制） */
  share(title: string, path: string): void;
}

export interface MediaAdapter {
  /** 选择图片并读取为 ArrayBuffer（供直传 PUT） */
  chooseImageAsArrayBuffer(count: number): Promise<{ data: ArrayBuffer; mime: string; name: string }[]>;
}

export interface PlatformAdapter {
  /** API 根地址（H5 同源 /petn/api/v1；小程序按配置域名） */
  apiBase(): string;
  storage: StorageAdapter;
  toast: ToastAdapter;
  modal: ModalAdapter;
  navigation: NavigationAdapter;
  share: ShareAdapter;
  media: MediaAdapter;
}
