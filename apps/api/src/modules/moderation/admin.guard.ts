import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ERROR_CODES } from '../../common/error-codes';
import { AuthUser } from '../../common/guards/auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminRoleCode } from './moderation-state';
import { ADMIN_ROLES_KEY } from './admin-roles.decorator';

export interface AdminActor {
  userId: string;
  roleCode: AdminRoleCode;
}

/**
 * 后台守卫（11.6 最小权限）：AuthGuard 之后执行。
 * - 必须是 ACTIVE 的 admin_users；super_admin 拥有全部权限；
 * - @AdminRoles(...) 限定允许的角色集合。
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const user = (req as { user?: AuthUser }).user;
    if (!user) {
      throw new UnauthorizedException({ code: ERROR_CODES.AUTH_REQUIRED, message: '需要登录' });
    }
    const admin = await this.prisma.adminUser.findUnique({
      where: { userId: user.id },
      include: { role: true },
    });
    if (!admin || admin.status !== 'ACTIVE') {
      throw new ForbiddenException({ code: ERROR_CODES.ADMIN_REQUIRED, message: '需要后台权限' });
    }
    const required = this.reflector.getAllAndOverride<AdminRoleCode[]>(ADMIN_ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    const roleCode = admin.role.code as AdminRoleCode;
    if (required && required.length > 0 && roleCode !== 'super_admin' && !required.includes(roleCode)) {
      throw new ForbiddenException({ code: ERROR_CODES.ADMIN_ROLE_REQUIRED, message: '当前后台角色无权执行该操作' });
    }
    (req as { admin?: AdminActor }).admin = { userId: user.id, roleCode };
    return true;
  }
}
