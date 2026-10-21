#!/usr/bin/env node
/**
 * 后台账号授权（M4，11.6 最小权限）：
 *
 *   node scripts/grant-admin.mjs --list                      # 查看最近用户（定位 userId）
 *   node scripts/grant-admin.mjs <userId或昵称> <role>       # 授权/变更角色
 *   node scripts/grant-admin.mjs <userId> disable            # 停用后台权限
 *
 * role ∈ content_moderator | support_operator | catalog_operator | analyst | super_admin
 * 需要 DATABASE_URL（apps/api/.env 或环境变量）。所有操作直接写库，生产执行前想清楚。
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

// 轻量加载 apps/api/.env（Prisma Client 运行时不自动读 .env）
if (!process.env.DATABASE_URL) {
  try {
    const envPath = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    }
  } catch {
    // 环境变量未提供时留给 Prisma 报错
  }
}

const prisma = new PrismaClient();

async function listUsers() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, nickname: true, status: true, createdAt: true },
  });
  const admins = await prisma.adminUser.findMany({ include: { role: true } });
  const adminMap = new Map(admins.map((a) => [a.userId, a]));
  console.log('最近 20 个用户：');
  for (const u of users) {
    const admin = adminMap.get(u.id);
    console.log(`  ${u.id}  ${u.nickname}  ${u.status}  ${u.createdAt.toISOString()}${admin ? `  [admin: ${admin.role.code}/${admin.status}]` : ''}`);
  }
}

async function grant(identifier, roleCode) {
  if (roleCode === 'disable') {
    const existing = await prisma.adminUser.findUnique({ where: { userId: identifier } });
    if (!existing) {
      console.error('该用户没有后台权限');
      process.exit(1);
    }
    await prisma.adminUser.update({ where: { userId: identifier } , data: { status: 'DISABLED' } });
    console.log(`已停用后台权限：${identifier}`);
    return;
  }
  const role = await prisma.adminRole.findUnique({ where: { code: roleCode } });
  if (!role) {
    console.error(`角色不存在：${roleCode}（可用：content_moderator/support_operator/catalog_operator/analyst/super_admin）`);
    process.exit(1);
  }
  let user = await prisma.user.findUnique({ where: { id: identifier } }).catch(() => null);
  if (!user) {
    const matches = await prisma.user.findMany({ where: { nickname: identifier }, take: 2 });
    if (matches.length !== 1) {
      console.error(matches.length === 0 ? '未找到用户（用 --list 查看）' : '昵称不唯一，请用 userId');
      process.exit(1);
    }
    user = matches[0];
  }
  await prisma.adminUser.upsert({
    where: { userId: user.id },
    create: { userId: user.id, roleId: role.id, status: 'ACTIVE' },
    update: { roleId: role.id, status: 'ACTIVE' },
  });
  console.log(`已授权：${user.nickname}（${user.id}）→ ${roleCode}`);
}

const [arg1, arg2] = process.argv.slice(2);
if (!arg1 || arg1 === '--list') {
  await listUsers();
} else if (!arg2) {
  console.error('用法：node scripts/grant-admin.mjs <userId或昵称> <role|disable>');
  process.exit(1);
} else {
  await grant(arg1, arg2);
}
await prisma.$disconnect();
