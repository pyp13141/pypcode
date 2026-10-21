import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** 控制器参数装饰器：@RequestId() requestId?: string（由 RequestIdMiddleware 注入，用于敏感审计） */
export const RequestId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string | undefined => {
  const req = ctx.switchToHttp().getRequest();
  return (req as { requestId?: string }).requestId;
});
