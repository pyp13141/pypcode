import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * M6 健康与情绪日志集成测试：
 * - 所有权（他人宠物 404）、枚举/时间/数值校验、紧急提示与免责文案随响应下发
 * - 列表过滤与分页；growth 榜单接线（近 30 天记录数）
 * - 徽章发放钩子补全：互助完成 → CARE_FIRST；首次评价 → REVIEW_FIRST
 */
describe('M6 health e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const owner = { agent: null as unknown as ReturnType<typeof request.agent>, id: '', petId: '' };
  const other = { agent: null as unknown as ReturnType<typeof request.agent>, id: '' };

  async function login(code: string) {
    const res = await request(app.getHttpServer()).post('/api/v1/auth/wechat/login').send({ code }).expect(200);
    return { agent: request.agent(app.getHttpServer()).set('Authorization', `Bearer ${res.body.data.accessToken}`), id: res.body.data.user.id as string };
  }

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
    await prisma.$executeRawUnsafe('TRUNCATE TABLE pet_health_logs, pet_mood_logs, posts, comments, follows, reports, notifications, help_posts, market_deals, market_listings, media_assets, disputes, user_badges, moderation_actions, app_settings, conversations, care_orders, care_requests, care_offerings, reactions, reviews, sensitive_access_logs, idempotency_records, care_evidence CASCADE');
    const a = await login('m6-owner');
    const o = await login('m6-other');
    owner.agent = a.agent; owner.id = a.id;
    other.agent = o.agent; other.id = o.id;
    // 成熟账号（避开新号审核路由）
    await prisma.user.update({ where: { id: owner.id }, data: { createdAt: new Date(Date.now() - 72 * 3600_000) } });
    const pet = await owner.agent.post('/api/v1/pets').send({ name: '豆豆', species: 'DOG' }).expect(201);
    owner.petId = pet.body.data.id;
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE pet_health_logs, pet_mood_logs, posts, comments, follows, reports, notifications, help_posts, market_deals, market_listings, media_assets, disputes, user_badges, moderation_actions, app_settings, conversations, care_orders, care_requests, care_offerings, reactions, reviews, sensitive_access_logs, idempotency_records, care_evidence CASCADE');
    await app.close();
  });

  describe('健康日志', () => {
    it('他人宠物 → 404；logType/source 非法 → 400；未来时间 → 400', async () => {
      const future = new Date(Date.now() + 3600_000).toISOString();
      await other.agent.post(`/api/v1/pets/${owner.petId}/health-logs`).send({ logType: 'WEIGHT', valueNum: 4, recordedAt: future }).expect(404);
      await owner.agent.post(`/api/v1/pets/${owner.petId}/health-logs`).send({ logType: 'HEIGHT', valueNum: 4, recordedAt: future }).expect(400);
      await owner.agent.post(`/api/v1/pets/${owner.petId}/health-logs`).send({ logType: 'WEIGHT', valueNum: 4, recordedAt: future, source: 'GUESS' }).expect(400);
      const bad = await owner.agent.post(`/api/v1/pets/${owner.petId}/health-logs`).send({ logType: 'WEIGHT', valueNum: 4, recordedAt: future }).expect(400);
      expect(bad.body.error.code).toBe('REQUEST_VALIDATION_FAILED');
    });

    it('正常记录（WEIGHT/DIET/EVENT；VET 来源）→ 响应带就医提示；列表按类型过滤+倒序', async () => {
      const w = await owner.agent
        .post(`/api/v1/pets/${owner.petId}/health-logs`)
        .send({ logType: 'WEIGHT', valueNum: 5.2, unit: 'kg', recordedAt: new Date(Date.now() - 3600_000).toISOString() })
        .expect(201);
      expect(w.body.data.emergencyHint).toContain('兽医');
      await owner.agent.post(`/api/v1/pets/${owner.petId}/health-logs`).send({ logType: 'DIET', recordedAt: new Date(Date.now() - 1800_000).toISOString(), notes: '狗粮 80g' }).expect(201);
      await owner.agent.post(`/api/v1/pets/${owner.petId}/health-logs`).send({ logType: 'EVENT', recordedAt: new Date().toISOString(), notes: '疫苗第二针', source: 'VET' }).expect(201);

      const list = await owner.agent.get(`/api/v1/pets/${owner.petId}/health-logs`).expect(200);
      expect(list.body.data).toHaveLength(3);
      expect(list.body.data[0].logType).toBe('EVENT');
      expect(list.body.meta.total).toBe(3);
      const diet = await owner.agent.get(`/api/v1/pets/${owner.petId}/health-logs?logType=DIET`).expect(200);
      expect(diet.body.data).toHaveLength(1);
      expect(diet.body.data[0].notes).toContain('狗粮');
      await other.agent.get(`/api/v1/pets/${owner.petId}/health-logs`).expect(404);
    });
  });

  describe('情绪日志', () => {
    it('标签白名单/数量/severity 校验；正常记录含免责声明；列表', async () => {
      await owner.agent.post(`/api/v1/pets/${owner.petId}/mood-logs`).send({ moodTags: ['飞起来'], observedAt: new Date().toISOString() }).expect(400);
      await owner.agent.post(`/api/v1/pets/${owner.petId}/mood-logs`).send({ moodTags: [], observedAt: new Date().toISOString() }).expect(400);
      await owner.agent.post(`/api/v1/pets/${owner.petId}/mood-logs`).send({ moodTags: ['平静'], severity: 9, observedAt: new Date().toISOString() }).expect(400);

      const ok = await owner.agent
        .post(`/api/v1/pets/${owner.petId}/mood-logs`)
        .send({ moodTags: ['平静', '活跃'], severity: 2, observedAt: new Date().toISOString(), notes: '公园玩得很开心' })
        .expect(201);
      expect(ok.body.data.disclaimer).toContain('不构成诊断');
      const list = await owner.agent.get(`/api/v1/pets/${owner.petId}/mood-logs`).expect(200);
      expect(list.body.data).toHaveLength(1);
      expect(list.body.data[0].moodTags).toEqual(['平静', '活跃']);
    });

    it('growth 榜单：按近 30 天记录数排名，规则可解释', async () => {
      const board = await request(app.getHttpServer()).get('/api/v1/community/leaderboards?type=growth').expect(200);
      expect(board.body.data.rule).toContain('近 30 天');
      expect(board.body.data.entries.some((e: { logCount: number; petName: string }) => e.petName === '豆豆' && e.logCount >= 4)).toBe(true);
    });
  });

  describe('徽章发放钩子（补全）', () => {
    it('互助订单完成 → 服务者获 CARE_FIRST；评价后评价者获 REVIEW_FIRST', async () => {
      // 需求方=owner？不行：申请者不能是自己。owner 发需求，other 申请，owner 接受
      const st = new Date(Date.now() + 3600_000).toISOString();
      const en = new Date(Date.now() + 3 * 3600_000).toISOString();
      const req = await owner.agent
        .post('/api/v1/care/requests')
        .send({ petIds: [owner.petId], serviceType: 'FEED', title: '徽章流程测试需求', description: 'x', areaCode: '440305', startAt: st, endAt: en, pricingType: 'FREE', cancelRule: 'FREE' })
        .expect(201);
      const app1 = await other.agent.post(`/api/v1/care/requests/${req.body.data.id}/applications`).send({ message: '我来帮忙' }).expect(201);
      const acc = await owner.agent
        .post(`/api/v1/care/applications/${app1.body.data.id}/accept`)
        .set('Idempotency-Key', 'm6-accept-1')
        .expect(200);
      const orderId = acc.body.data.orderId;
      await owner.agent.put(`/api/v1/care/orders/${orderId}/private-details`).send({ address: '徽章测试路 1 号' }).expect(200);
      await owner.agent.post(`/api/v1/care/orders/${orderId}/confirm`).expect(200);
      await other.agent.post(`/api/v1/care/orders/${orderId}/confirm`).expect(200);
      await other.agent.post(`/api/v1/care/orders/${orderId}/start`).expect(200);
      await other.agent.post(`/api/v1/care/orders/${orderId}/complete`).set('Idempotency-Key', 'm6-complete-1').expect(200);
      await owner.agent.post(`/api/v1/care/orders/${orderId}/complete`).set('Idempotency-Key', 'm6-confirm-1').expect(200);

      const providerBadges = await other.agent.get('/api/v1/badges').expect(200);
      expect(providerBadges.body.data.earned.some((b: { code: string }) => b.code === 'CARE_FIRST')).toBe(true);

      await owner.agent
        .post(`/api/v1/care/orders/${orderId}/reviews`)
        .set('Idempotency-Key', 'm6-review-1')
        .send({ rating: 5 })
        .expect(200);
      const requesterBadges = await owner.agent.get('/api/v1/badges').expect(200);
      expect(requesterBadges.body.data.earned.some((b: { code: string }) => b.code === 'REVIEW_FIRST')).toBe(true);
    });
  });
});
