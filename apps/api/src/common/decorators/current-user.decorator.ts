import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '../guards/auth.guard';

/** 控制器参数装饰器：@CurrentUser() user: AuthUser */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as AuthUser;
  },
);
