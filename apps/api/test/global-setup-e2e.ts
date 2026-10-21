import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/** 集成测试全局准备：迁移测试库（幂等）。密码从 PETN_DB_PASSWORD_FILE 或 PETN_TEST_DB_PASSWORD 注入。 */
export default async function globalSetup(): Promise<void> {
  const passwordFile = process.env.PETN_DB_PASSWORD_FILE;
  const password = passwordFile
    ? readFileSync(passwordFile, 'utf8').trim()
    : process.env.PETN_TEST_DB_PASSWORD;
  if (!password) {
    throw new Error('缺少测试库密码：请设置 PETN_DB_PASSWORD_FILE 或 PETN_TEST_DB_PASSWORD');
  }
  process.env.__TEST_DB_PASSWORD__ = password;
  const url = `postgresql://petn_app:${password}@127.0.0.1:5432/pet_neighbor_test`;
  execSync('pnpm exec prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
}
