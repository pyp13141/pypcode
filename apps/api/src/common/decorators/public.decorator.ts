import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../guards/auth.guard';

/** 标记路由免登录：@Public() */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
