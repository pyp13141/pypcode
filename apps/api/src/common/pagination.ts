/**
 * 通用分页（docs/API.md §0 约定）：
 * 请求 `?page=1&pageSize=20`（pageSize 上限 50，越界按边界收敛不发 400）；
 * 响应 `data: [...]`，`meta: { requestId, page, pageSize, total }`（由信封拦截器合并）。
 */
export const PAGINATION_MARKER = '__paginated' as const;

export interface Paginated<T> {
  [PAGINATION_MARKER]: true;
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export function paginate<T>(items: T[], page: number, pageSize: number, total: number): Paginated<T> {
  return { [PAGINATION_MARKER]: true, items, page, pageSize, total };
}

export function isPaginated(value: unknown): value is Paginated<unknown> {
  return typeof value === 'object' && value !== null && (value as Record<string, unknown>)[PAGINATION_MARKER] === true;
}

/** 解析分页参数；缺省 page=1、pageSize=20，pageSize 收敛到 [1,50]，page 收敛到 [1,∞) */
export function parsePagination(query: { page?: string; pageSize?: string }): {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
} {
  const pageRaw = Number(query.page ?? 1);
  const sizeRaw = Number(query.pageSize ?? 20);
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  const pageSize = Number.isFinite(sizeRaw) && sizeRaw >= 1 ? Math.min(Math.floor(sizeRaw), 50) : 20;
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
