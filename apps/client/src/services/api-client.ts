import Taro from '@tarojs/taro';
import { platform } from '../adapters';

export interface ApiEnvelope<T> {
  data: T | null;
  meta: { requestId: string; page?: number; pageSize?: number; total?: number };
  error: { code: string; message: string } | null;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const TOKEN_KEY = 'accessToken';
let onUnauthorized: (() => void) | null = null;

export const auth = {
  token: () => platform.storage.get(TOKEN_KEY),
  setToken: (token: string) => platform.storage.set(TOKEN_KEY, token),
  clear: () => platform.storage.remove(TOKEN_KEY),
  /** 401 时统一回调（跳登录） */
  setUnauthorizedHandler: (handler: () => void) => {
    onUnauthorized = handler;
  },
};

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  data?: unknown,
  options?: { idempotencyKey?: string; auth?: boolean },
): Promise<T> {
  const token = auth.token();
  const useAuth = options?.auth !== false;
  if (useAuth && !token) {
    throw new ApiError('AUTH_REQUIRED', '请先登录', 401);
  }
  const res = await Taro.request({
    url: `${platform.apiBase()}${path}`,
    method,
    data: data as never,
    header: {
      'Content-Type': 'application/json',
      ...(useAuth && token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
    },
  });
  const body = res.data as ApiEnvelope<T>;
  if (res.statusCode >= 200 && res.statusCode < 300 && body && body.error === null) {
    return body.data as T;
  }
  const code = body?.error?.code ?? 'REQUEST_FAILED';
  const message = body?.error?.message ?? `请求失败（${res.statusCode}）`;
  if (res.statusCode === 401) {
    auth.clear();
    onUnauthorized?.();
  }
  throw new ApiError(code, message, res.statusCode);
}

export interface RequestOptions {
  /** 是否要求登录态（公开接口传 false 才能匿名调用，如登录/发码） */
  auth?: boolean;
  idempotencyKey?: string;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, undefined, options),
  post: <T>(path: string, data?: unknown, options?: RequestOptions) => request<T>('POST', path, data, options),
  put: <T>(path: string, data?: unknown, options?: RequestOptions) => request<T>('PUT', path, data, options),
  patch: <T>(path: string, data?: unknown, options?: RequestOptions) => request<T>('PATCH', path, data, options),
  delete: <T>(path: string, data?: unknown, options?: RequestOptions) => request<T>('DELETE', path, data, options),
};

/** 幂等键：客户端生成（重试沿用同一 key） */
export function newIdempotencyKey(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${random}`;
}

/** 分页响应 */
export interface Paged<T> {
  items: T[];
  page: number;
  total: number;
}

export async function fetchPaged<T>(path: string): Promise<Paged<T>> {
  const res = await Taro.request({
    url: `${platform.apiBase()}${path}`,
    method: 'GET',
    header: { ...(auth.token() ? { Authorization: `Bearer ${auth.token()}` } : {}) },
  });
  const body = res.data as ApiEnvelope<T[]>;
  if (res.statusCode >= 200 && res.statusCode < 300 && body.error === null) {
    return {
      items: (body.data ?? []) as T[],
      page: body.meta.page ?? 1,
      total: body.meta.total ?? 0,
    };
  }
  throw new ApiError(body?.error?.code ?? 'REQUEST_FAILED', body?.error?.message ?? '请求失败', res.statusCode);
}
