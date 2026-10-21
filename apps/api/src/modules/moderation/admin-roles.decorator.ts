import { SetMetadata } from '@nestjs/common';
import { AdminRoleCode } from './moderation-state';

export const ADMIN_ROLES_KEY = 'adminRoles';

/** 限定后台角色：@AdminRoles('content_moderator')（super_admin 始终放行） */
export const AdminRoles = (...roles: AdminRoleCode[]) => SetMetadata(ADMIN_ROLES_KEY, roles);
