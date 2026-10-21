import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ERROR_CODES } from '../error-codes';
import { hashToken } from '../crypto/sensitive-crypto';
import { PrismaService } from '../../prisma/prisma.service';

export const IS_PUBLIC_KEY = 'isPublic';
export interface AuthUser {
  id: string;
  status: string;
}

/**
 * Bearer 令牌守卫：哈希查 session → 校验未撤销未过期 → 校验用户 ACTIVE。
 * @Public() 路由不强制登录，但**仍解析并注入令牌用户**（公开≠无视登录态：
 * 字段白名单按"登录的主人 vs 陌生人"区分，见 pets pet-by-id）。
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException({ code: ERROR_CODES.AUTH_REQUIRED, message: '需要登录' });
    }

    const session = await this.prisma.userSession.findUnique({
      where: { accessTokenHash: hashToken(token) },
      include: { user: true },
    });
    const valid =
      session !== null &&
      session.revokedAt === null &&
      session.accessExpiresAt >= new Date() &&
      session.user !== null &&
      session.user.deletedAt === null;

    if (!valid) {
      if (isPublic) return true; // 公开路由：坏令牌不拦截，但也不注入身份
      throw new UnauthorizedException({ code: ERROR_CODES.AUTH_REQUIRED, message: '登录已失效' });
    }
    if (session!.user.status === 'BANNED') {
      // 封禁用户即使访问公开路由也拒绝（全站不可用）
      throw new UnauthorizedException({ code: ERROR_CODES.USER_BANNED, message: '账号已被封禁' });
    }

    (req as { user?: AuthUser }).user = { id: session!.userId, status: session!.user.status };
    return true;
  }
}
