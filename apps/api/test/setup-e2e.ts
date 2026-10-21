/**
 * 集成测试环境：指向 pet_neighbor_test 库（与生产隔离）。
 * 迁移在 globalSetup 执行；每个测试文件自建 Nest app。
 */
process.env.NODE_ENV = 'test';
process.env.API_PORT = '0';
process.env.ALLOW_WECHAT_MOCK = 'true';
// 媒体管线本地盘适配器：测试用临时目录，绝不落生产目录（D-007）
process.env.MEDIA_DIR = process.env.TEST_MEDIA_DIR ?? '/tmp/petn-media-e2e';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://petn_app:placeholder@127.0.0.1:5432/pet_neighbor_test';

// 用真实密码覆盖（由 jest globalSetup 注入到 process.env）
if (process.env.__TEST_DB_PASSWORD__) {
  const u = new URL(process.env.DATABASE_URL);
  u.password = process.env.__TEST_DB_PASSWORD__;
  process.env.DATABASE_URL = u.toString();
}
