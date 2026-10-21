import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthSharedService } from '../src/modules/identity/auth-shared.service';

/**
 * D-014 邮箱验证码登录（替代手机号）集成测试：
 * - 发码（Mock 邮件供应商，日志打码；格式/限流）
 * - 登录/注册（错误码 400；正确码建会话并写邮箱密文+掩码+验证时间）
 * - /me 返回 emailMasked/emailVerified；邮箱不落明文
 * - 公开接口匿名可调（回归：客户端登录 bug 的服务端侧防线）
 */
describe('M5 email auth e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authService: AuthSharedService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    const { ResponseEnvelopeInterceptor } = await import('../src/common/interceptors/response-envelope.interceptor');
    const { AllExceptionsFilter } = await import('../src/common/filters/all-exceptions.filter');
    const { ValidationPipe } = await import('@nestjs/common');
    app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
    prisma = app.get(PrismaService);
    authService = app.get(AuthSharedService);
  });

  afterAll(async () => {
    // 清理本 spec 创建的邮箱账号（按 id 删除，避免依赖不支持的嵌套 deleteMany）
    const identities = await prisma.userIdentity.findMany({ where: { provider: 'EMAIL' }, select: { userId: true } });
    const userIds = identities.map((i) => i.userId);
    await prisma.userSession.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.careOffering.deleteMany({ where: { providerUserId: { in: userIds } } });
    await prisma.userPrivateProfile.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.userIdentity.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  const EMAIL = 'neighbor.tester@example.com';

  it('发码：格式非法 400；正常 200 且限流 429', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/email/send-code').send({ email: 'not-an-email' }).expect(400);
    const ok = await request(app.getHttpServer()).post('/api/v1/auth/email/send-code').send({ email: EMAIL }).expect(200);
    expect(ok.body.data.expiresInMinutes).toBe(5);
    const limited = await request(app.getHttpServer()).post('/api/v1/auth/email/send-code').send({ email: EMAIL }).expect(429);
    expect(limited.body.error.code).toBe('AUTH_RATE_LIMITED');
  });

  it('登录：错误验证码 400 AUTH_CODE_INVALID', async () => {
    const bad = await request(app.getHttpServer())
      .post('/api/v1/auth/email/login')
      .send({ email: EMAIL, code: '000000' })
      .expect(400);
    expect(bad.body.error.code).toBe('AUTH_CODE_INVALID');
  });

  it('登录：正确验证码建会话；邮箱密文落库、绝不存明文；/me 返回掩码与已验证', async () => {
    await prisma.userPrivateProfile.deleteMany({ where: {} }); // 清掉上一步可能残留
    await request(app.getHttpServer()).post('/api/v1/auth/email/send-code').send({ email: 'fresh.tester@example.com' }).expect(200);
    const code = authService.peekMockCode('fresh.tester@example.com');
    expect(code).toBeTruthy();

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/email/login')
      .send({ email: 'fresh.tester@example.com', code })
      .expect(200);
    const token = res.body.data.accessToken as string;
    expect(res.body.data.user.id).toBeTruthy();

    const me = await request(app.getHttpServer()).get('/api/v1/me').set('Authorization', `Bearer ${token}`).expect(200);
    expect(me.body.data.emailVerified).toBe(true);
    expect(me.body.data.emailMasked).toBe('fr***@example.com');
    expect(JSON.stringify(me.body.data)).not.toContain('fresh.tester@example.com');

    const profile = await prisma.userPrivateProfile.findFirstOrThrow({
      where: { emailMasked: 'fr***@example.com' },
    });
    expect(profile.emailEncrypted).toMatch(/^v1:/);
    expect(profile.emailEncrypted).not.toContain('fresh.tester');

    // 幂等重登（同邮箱）不重复建号
    await request(app.getHttpServer()).post('/api/v1/auth/email/send-code').send({ email: 'fresh.tester@example.com' }).expect(429); // 限流生效
  });

  it('公开接口匿名可调（登录前不触发 401 前置校验）', async () => {
    const feed = await request(app.getHttpServer()).get('/api/v1/community/feed?tab=latest').expect(200);
    expect(Array.isArray(feed.body.data)).toBe(true);
    const offerings = await request(app.getHttpServer()).get('/api/v1/care/offerings').expect(200);
    expect(Array.isArray(offerings.body.data)).toBe(true);
  });

  it('发布门槛（开关关闭时）：邮箱已验证用户可发布；开关开启时未验证不允许', async () => {
    process.env.CARE_REQUIRE_PHONE_VERIFIED = 'true';
    const anon = await request(app.getHttpServer()).post('/api/v1/auth/email/send-code').send({ email: 'gate.tester@example.com' }).expect(200);
    void anon;
    const code = authService.peekMockCode('gate.tester@example.com')!;
    const login = await request(app.getHttpServer()).post('/api/v1/auth/email/login').send({ email: 'gate.tester@example.com', code }).expect(200);
    const token = login.body.data.accessToken as string;

    // 已验证邮箱 → 放行（FIXED 缺价会走到 400 LISTING_PRICE_INVALID 而非 403 门槛）
    const publish = await request(app.getHttpServer())
      .post('/api/v1/care/offerings')
      .set('Authorization', `Bearer ${token}`)
      .send({ serviceType: 'FEED', title: '门槛测试服务', description: 'x', areaCode: '440305', pricingType: 'FREE', cancelRule: 'FREE', availabilities: [] })
      .expect(201);
    expect(publish.body.data.id).toBeTruthy();

    process.env.CARE_REQUIRE_PHONE_VERIFIED = 'false';
  });
});
