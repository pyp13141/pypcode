import Taro from '@tarojs/taro';
import { platform } from '../adapters';
import { api, auth } from './api-client';

export interface MeView {
  id: string;
  emailMasked: string | null;
  emailVerified: boolean;
  nickname: string;
  avatarUrl: string | null;
  bio: string | null;
  areaCode: string | null;
  phoneMasked: string | null;
  phoneVerified: boolean;
  createdAt: string;
}

/** 邮箱验证码发送（D-014：首期以邮箱替代手机号） */
/** 发送邮箱验证码；内测直显模式（AUTH_CODE_ECHO）返回 devCode 供页面自动填入 */
export async function sendEmailCode(email: string): Promise<string | null> {
  const res = await api.post<{ expiresInMinutes: number; devCode?: string }>('/auth/email/send-code', { email }, { auth: false });
  return res.devCode ?? null;
}

/** 邮箱验证码登录/注册 */
export async function loginWithEmail(email: string, code: string): Promise<void> {
  const data = await api.post<{ accessToken: string }>('/auth/email/login', { email, code }, { auth: false });
  auth.setToken(data.accessToken);
}

export async function loginWithWechat(): Promise<void> {
  let code = '';
  if (process.env.TARO_ENV === 'weapp') {
    const res = await Taro.login();
    code = res.code;
  } else {
    // H5 开发期：设备持久化一个稳定的模拟 code（服务端 Mock 派生 openid，D-006）
    const existing = platform.storage.get('devWechatCode');
    code = existing ?? `h5-${Math.random().toString(36).slice(2, 10)}`;
    platform.storage.set('devWechatCode', code);
  }
  const data = await api.post<{ accessToken: string }>('/auth/wechat/login', { code }, { auth: false });
  auth.setToken(data.accessToken);
}

export async function loginWithPhone(phone: string, code: string): Promise<void> {
  const data = await api.post<{ accessToken: string }>('/auth/h5/login', { phone, code }, { auth: false });
  auth.setToken(data.accessToken);
}

export async function sendSmsCode(phone: string): Promise<void> {
  await api.post('/auth/sms/send-code', { phone }, { auth: false });
}

export async function fetchMe(): Promise<MeView> {
  return api.get<MeView>('/me');
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout').catch(() => undefined);
  auth.clear();
}

/**
 * 登录门禁（UX-REVIEW P1）：发布/交易等写操作入口先校验令牌，
 * 未登录 toast 引导并跳登录页。返回 false 时调用方直接 return。
 */
export function ensureAuth(action = '使用该功能'): boolean {
  if (auth.token()) return true;
  platform.toast.info(`请先登录后再${action}`);
  platform.navigation.to('/pages/login/index');
  return false;
}
