import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { ResponseEnvelopeInterceptor } from './response-envelope.interceptor';

describe('ResponseEnvelopeInterceptor', () => {
  const interceptor = new ResponseEnvelopeInterceptor();

  function ctxWith(headers: Record<string, string> = {}): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ ...headers }),
        getResponse: () => ({}),
      }),
    } as unknown as ExecutionContext;
  }

  const next: CallHandler = { handle: () => of({ hello: 'world' }) };

  it('包裹 data 并生成 requestId', async () => {
    const res = await firstValueFrom(interceptor.intercept(ctxWith(), next));
    expect(res.data).toEqual({ hello: 'world' });
    expect(res.error).toBeNull();
    expect(typeof res.meta.requestId).toBe('string');
    expect(res.meta.requestId.length).toBeGreaterThan(0);
  });

  it('沿用上游合法的 X-Request-Id', async () => {
    const res = await firstValueFrom(
      interceptor.intercept(ctxWith({ requestId: 'req_abc-123' }), next),
    );
    expect(res.meta.requestId).toBe('req_abc-123');
  });

  it('分页结果把 page/pageSize/total 合并进 meta（data 为数组）', async () => {
    const { paginate } = await import('../pagination');
    const paged: CallHandler = { handle: () => of(paginate([{ id: 'a' }], 2, 10, 21)) };
    const res = await firstValueFrom(interceptor.intercept(ctxWith(), paged));
    expect(res.data).toEqual([{ id: 'a' }]);
    expect(res.meta).toMatchObject({ page: 2, pageSize: 10, total: 21 });
  });
});
