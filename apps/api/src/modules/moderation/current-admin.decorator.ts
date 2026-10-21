import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AdminActor } from './admin.guard';

/** 控制器参数装饰器：@CurrentAdmin() admin: AdminActor（AdminGuard 注入） */
export const CurrentAdmin = createParamDecorator((_data: unknown, ctx: ExecutionContext): AdminActor => {
  const req = ctx.switchToHttp().getRequest();
  return (req as { admin?: AdminActor }).admin as AdminActor;
});
