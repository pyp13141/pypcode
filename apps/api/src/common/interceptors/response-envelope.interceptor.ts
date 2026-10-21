import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { isPaginated } from '../pagination';

export interface ApiEnvelope<T> {
  data: T;
  meta: { requestId: string; page?: number; pageSize?: number; total?: number };
  error: null;
}

/**
 * 统一响应包裹（docs/API.md 10.1）。控制器只返回 data，由本拦截器加信封。
 * 分页结果（common/pagination.ts 的 paginate()）把分页信息合并进 meta。
 */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiEnvelope<unknown>> {
    const req = context.switchToHttp().getRequest();
    const requestId: string = req.requestId ?? randomUUID();
    return next.handle().pipe(
      map((data) => {
        if (isPaginated(data)) {
          return {
            data: data.items,
            meta: { requestId, page: data.page, pageSize: data.pageSize, total: data.total },
            error: null,
          };
        }
        return { data, meta: { requestId }, error: null };
      }),
    );
  }
}
