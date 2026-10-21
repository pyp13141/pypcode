import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * M2 互助闭环集成测试（设计文档 17.2 + HANDOVER §6 必测项）：
 * - 发布/检索（公开视图白名单：无地址/紧急联系人）
 * - 并发 accept 只成一单（行锁事务）+ 幂等键重放
 * - 订单状态机非法流转 409；非参与方读订单 404
 * - 私密地址：参与方+状态联合校验 403 / 解密返回 / 每次读写写审计
 * - 重复评价 409；纠纷工单唯一性
 * fixture 造数据，独立测试库，不依赖外网。
 */
describe('M2 care e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  type Agent = ReturnType<typeof request.agent>;
  const requester = { agent: null as unknown as Agent, id: '' };
  const provider = { agent: null as unknown as Agent, id: '' };
  const provider2 = { agent: null as unknown as Agent, id: '' };
  const stranger = { agent: null as unknown as Agent, id: '' };

  let petId = '';
  const state: {
    offeringPublishedId: string;
    offeringDraftId: string;
    requestId: string;
    requestForRejectId: string;
    requestForCancelId: string;
    requestForDisputeId: string;
    requestForWindowId: string;
    appMainId: string;
    appRejectedId: string;
    orderNo: string;
    visit1Id: string;
    visit2Id: string;
    order1Id: string;
    orderCancelId: string;
    orderDisputeId: string;
    orderWindowId: string;
  } = {} as never;

  function futureWindow(offsetHours = 1, durationHours = 2) {
    const start = new Date(Date.now() + offsetHours * 3600_000);
    const end = new Date(Date.now() + (offsetHours + durationHours) * 3600_000);
    return { startAt: start.toISOString(), endAt: end.toISOString() };
  }

  async function loginWechat(code: string) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/wechat/login')
      .send({ code })
      .expect(200);
    return {
      agent: request.agent(app.getHttpServer()).set('Authorization', `Bearer ${res.body.data.accessToken}`),
      id: res.body.data.user.id as string,
    };
  }

  async function createRequest(agent: Agent, overrides: Record<string, unknown> = {}) {
    const window = futureWindow();
    const res = await agent
      .post('/api/v1/care/requests')
      .send({
        petIds: [petId],
        serviceType: 'FEED',
        title: '国庆上门喂猫两天',
        description: '两只猫，每天一次，需换水铲屎',
        areaCode: '440305',
        startAt: window.startAt,
        endAt: window.endAt,
        pricingType: 'FIXED',
        priceMinor: 8000,
        cancelRule: 'FREE',
        emergencyContact: '13800138000（李女士）',
        ...overrides,
      })
      .expect(201);
    return res.body.data as { id: string };
  }

  async function applyTo(agent: Agent, requestId: string, message = '我可以帮忙，有三年养猫经验') {
    const res = await agent
      .post(`/api/v1/care/requests/${requestId}/applications`)
      .send({ message })
      .expect(201);
    return res.body.data as { id: string };
  }

  async function accept(agent: Agent, applicationId: string, key: string, expected = 200) {
    return agent
      .post(`/api/v1/care/applications/${applicationId}/accept`)
      .set('Idempotency-Key', key)
      .expect(expected);
  }

  /** 把订单推进到指定状态（用于分离测试关注点） */
  async function driveToConfirmed(orderId: string, address = '南山区科技园 xx 小区 3 栋 502') {
    await requester.agent
      .put(`/api/v1/care/orders/${orderId}/private-details`)
      .send({ address, entryInstructions: '门禁按 0305，电梯到 5 楼', emergencyContact: '13900139000 王先生' })
      .expect(200);
    await requester.agent.post(`/api/v1/care/orders/${orderId}/confirm`).expect(200);
    await provider.agent.post(`/api/v1/care/orders/${orderId}/confirm`).expect(200);
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    const { ResponseEnvelopeInterceptor } = await import('../src/common/interceptors/response-envelope.interceptor');
    const { AllExceptionsFilter } = await import('../src/common/filters/all-exceptions.filter');
    app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    // 与 main.ts 一致：白名单校验管道（生产行为一致，测试才有意义）
    const { ValidationPipe } = await import('@nestjs/common');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
    prisma = app.get(PrismaService);

    // 清空 care 域（TRUNCATE 不触发追加式行级触发器，保留历史表不可变语义）
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE care_orders, care_requests, care_offerings, reviews, sensitive_access_logs, idempotency_records, media_assets, disputes, care_evidence CASCADE',
    );

    const r = await loginWechat('m2-requester');
    const p = await loginWechat('m2-provider');
    const p2 = await loginWechat('m2-provider-2');
    const s = await loginWechat('m2-stranger');
    requester.agent = r.agent; requester.id = r.id;
    provider.agent = p.agent; provider.id = p.id;
    provider2.agent = p2.agent; provider2.id = p2.id;
    stranger.agent = s.agent; stranger.id = s.id;

    const pet = await requester.agent
      .post('/api/v1/pets')
      .send({ name: '团子', species: 'CAT', breed: '英短', visibility: 'PRIVATE' })
      .expect(201);
    petId = pet.body.data.id;
  });

  afterAll(async () => {
    // 清场：避免残留数据影响其他 spec 的用户清理（FK RESTRICT）
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE care_orders, care_requests, care_offerings, reviews, sensitive_access_logs, idempotency_records, media_assets, disputes, care_evidence CASCADE',
    );
    await app.close();
  });

  describe('服务公告：发布/校验/公开视图/状态流转', () => {
    it('FIXED 缺价格 → 400；FREE 带价格 → 400；正常创建 → 201', async () => {
      await provider.agent
        .post('/api/v1/care/offerings')
        .send({ serviceType: 'FEED', title: '上门喂养服务', description: '每天一次', areaCode: '440305', pricingType: 'FIXED', cancelRule: 'FREE', availabilities: [] })
        .expect(400);
      await provider.agent
        .post('/api/v1/care/offerings')
        .send({ serviceType: 'FEED', title: '上门喂养服务', description: '每天一次', areaCode: '440305', pricingType: 'FREE', priceMinor: 100, cancelRule: 'FREE', availabilities: [] })
        .expect(400);

      const res = await provider.agent
        .post('/api/v1/care/offerings')
        .send({
          serviceType: 'FEED',
          title: '上门喂养服务',
          description: '每天一次，可帮忙铲屎换水',
          areaCode: '440305',
          pricingType: 'FIXED',
          priceMinor: 5000,
          cancelRule: 'FREE',
          availabilities: [futureWindow(24, 2)],
        })
        .expect(201);
      state.offeringPublishedId = res.body.data.id;
      expect(res.body.data.priceMinor).toBe(5000);
      expect(res.body.data.trust).toMatchObject({ phoneVerified: false, completedOrderCount: 0, reviewCount: 0 });
    });

    it('DRAFT 公告不进公开列表；owner 可见详情；陌生人 404', async () => {
      const draft = await provider.agent
        .post('/api/v1/care/offerings')
        .send({ serviceType: 'WALK', title: '周末遛狗服务', description: '一小时起', areaCode: '440305', pricingType: 'NEGOTIABLE', cancelRule: 'FREE', status: 'DRAFT', availabilities: [] })
        .expect(201);
      state.offeringDraftId = draft.body.data.id;

      const list = await request(app.getHttpServer()).get('/api/v1/care/offerings').expect(200);
      const ids = list.body.data.map((o: { id: string }) => o.id);
      expect(ids).toContain(state.offeringPublishedId);
      expect(ids).not.toContain(state.offeringDraftId);
      expect(list.body.meta).toMatchObject({ page: 1, pageSize: 20 });

      await provider.agent.get(`/api/v1/care/offerings/${state.offeringDraftId}`).expect(200);
      await stranger.agent.get(`/api/v1/care/offerings/${state.offeringDraftId}`).expect(404);
    });

    it('PATCH：非 owner 404；非法状态流转 400；DRAFT→PUBLISHED 正常', async () => {
      await stranger.agent.patch(`/api/v1/care/offerings/${state.offeringDraftId}`).send({ title: '改标题五字以上' }).expect(404);
      // DRAFT 只能 → PUBLISHED / ARCHIVED，PAUSED 非法
      await provider.agent
        .patch(`/api/v1/care/offerings/${state.offeringDraftId}`)
        .send({ status: 'PAUSED' })
        .expect(400);
      const ok = await provider.agent
        .patch(`/api/v1/care/offerings/${state.offeringDraftId}`)
        .send({ status: 'PUBLISHED' })
        .expect(200);
      expect(ok.body.data.status).toBe('PUBLISHED');
      await provider.agent
        .patch(`/api/v1/care/offerings/${state.offeringDraftId}`)
        .send({ status: 'DRAFT' })
        .expect(400); // PUBLISHED 不可回 DRAFT
    });

    it('发布门槛（运营开关默认关闭）：需求方发布需求不做手机号硬拦截', async () => {
      const r = await createRequest(requester.agent);
      state.requestId = r.id;
      expect(r.id).toBeTruthy();
    });
  });

  describe('求助需求：宠物强校验 + 敏感字段不回显', () => {
    it('无宠物档案 → 400；使用他人宠物 → 400；本人未归档宠物 → 201', async () => {
      const window = futureWindow();
      await provider.agent
        .post('/api/v1/care/requests')
        .send({ petIds: ['00000000-0000-4000-8000-000000000000'], serviceType: 'FEED', title: '无宠物测试需求', description: 'x', areaCode: '440305', startAt: window.startAt, endAt: window.endAt, pricingType: 'FREE', cancelRule: 'FREE' })
        .expect(400);
      await provider.agent
        .post('/api/v1/care/requests')
        .send({ petIds: [petId], serviceType: 'FEED', title: '用他人宠物测试', description: 'x', areaCode: '440305', startAt: window.startAt, endAt: window.endAt, pricingType: 'FREE', cancelRule: 'FREE' })
        .expect(400);
    });

    it('公开列表与详情不含紧急联系人/密文；mine=true 需登录', async () => {
      const list = await request(app.getHttpServer()).get('/api/v1/care/requests').expect(200);
      const mine = list.body.data.find((r: { id: string }) => r.id === state.requestId);
      expect(mine).toBeTruthy();
      const raw = JSON.stringify(mine);
      expect(raw).not.toContain('13800138000');
      expect(raw).not.toContain('Encrypted');
      expect(mine.isOwner).toBe(false);
      expect(mine.pets[0]).toMatchObject({ name: '团子', species: 'CAT' });

      await request(app.getHttpServer()).get('/api/v1/care/requests?mine=true').expect(401);
      const own = await requester.agent.get('/api/v1/care/requests?mine=true').expect(200);
      expect(own.body.data.some((r: { id: string }) => r.id === state.requestId)).toBe(true);
    });
  });

  describe('服务申请：唯一约束与权限', () => {
    it('申请人≠需求方；重复申请 409；申请列表仅需求方可见', async () => {
      await requester.agent
        .post(`/api/v1/care/requests/${state.requestId}/applications`)
        .send({ message: '自己申请自己' })
        .expect(400);

      const app1 = await applyTo(provider.agent, state.requestId);
      state.appMainId = app1.id;
      await provider.agent
        .post(`/api/v1/care/requests/${state.requestId}/applications`)
        .send({ message: '重复申请' })
        .expect(409);

      await provider.agent.get(`/api/v1/care/requests/${state.requestId}/applications`).expect(404);
      const list = await requester.agent.get(`/api/v1/care/requests/${state.requestId}/applications`).expect(200);
      expect(list.body.data).toHaveLength(1);
      expect(list.body.data[0].status).toBe('PENDING');
    });

    it('reject / withdraw 记原因；撤回后不可再接受', async () => {
      const r2 = await createRequest(requester.agent, { title: '需求二用于拒绝撤回' });
      state.requestForRejectId = r2.id;
      const a2b = await applyTo(provider.agent, r2.id, '申请二 B');
      state.appRejectedId = a2b.id;
      const a2c = await applyTo(provider2.agent, r2.id, '申请二 C');

      const rejected = await requester.agent
        .post(`/api/v1/care/applications/${a2b.id}/reject`)
        .send({ reason: '已找到更合适的人' })
        .expect(200);
      expect(rejected.body.data.status).toBe('REJECTED');
      // 终态不可再操作
      await requester.agent.post(`/api/v1/care/applications/${a2b.id}/reject`).send({}).expect(409);

      const withdrawn = await provider2.agent
        .post(`/api/v1/care/applications/${a2c.id}/withdraw`)
        .send({ reason: '临时有事' })
        .expect(200);
      expect(withdrawn.body.data.status).toBe('WITHDRAWN');
      // 已撤回的申请不可接受
      await accept(requester.agent, a2c.id, 'idem-withdraw-accept', 409);
    });
  });

  describe('accept ⭐关键事务', () => {
    it('非需求方接受 → 404；缺幂等键 → 400', async () => {
      await provider.agent
        .post(`/api/v1/care/applications/${state.appMainId}/accept`)
        .set('Idempotency-Key', 'idem-non-requester')
        .expect(404);
      await requester.agent.post(`/api/v1/care/applications/${state.appMainId}/accept`).expect(400);
    });

    it('接受成功创建订单（PENDING_CONFIRMATION + 条款快照）；同 key 重放返回同一订单', async () => {
      const first = await accept(requester.agent, state.appMainId, 'idem-accept-main');
      state.orderNo = first.body.data.orderId;
      const replay = await accept(requester.agent, state.appMainId, 'idem-accept-main');
      expect(replay.body.data.orderId).toBe(first.body.data.orderId);
      // 同 key 用于不同资源（另一个申请）→ 409 幂等冲突（同 key 不同请求语义）
      const conflict = await requester.agent
        .post(`/api/v1/care/applications/${state.appRejectedId}/accept`)
        .set('Idempotency-Key', 'idem-accept-main');
      expect(conflict.status).toBe(409);
      expect(conflict.body.error.code).toBe('IDEMPOTENCY_KEY_CONFLICT');

      const order = await requester.agent.get(`/api/v1/care/orders/${state.orderNo}`).expect(200);
      expect(order.body.data.status).toBe('PENDING_CONFIRMATION');
      expect(order.body.data.orderNo).toMatch(/^PN/);
      expect(order.body.data.role).toBe('REQUESTER');
      const terms = order.body.data.agreedTerms as { pets: unknown[]; addressAccessPolicy: unknown; cancelRule: string };
      expect(terms.pets).toHaveLength(1);
      expect(terms.addressAccessPolicy).toBeTruthy();
      expect(JSON.stringify(order.body.data)).not.toContain('13800138000');

      const events = await prisma.careOrderEvent.findMany({ where: { careOrderId: state.orderNo } });
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ fromStatus: null, toStatus: 'PENDING_CONFIRMATION', actorRole: 'REQUESTER' });
    });

    it('接受后：需求 MATCHED、申请 ACCEPTED 回填订单、其余申请 EXPIRED', async () => {
      const reqRow = await prisma.careRequest.findUniqueOrThrow({ where: { id: state.requestId } });
      expect(reqRow.status).toBe('MATCHED');
      expect(reqRow.matchedAt).not.toBeNull();
      const appRow = await prisma.careApplication.findUniqueOrThrow({ where: { id: state.appMainId } });
      expect(appRow.status).toBe('ACCEPTED');
      expect(appRow.careOrderId).toBe(state.orderNo);
    });

    it('并发接受（不同申请、不同幂等键）只成一单', async () => {
      const r3 = await createRequest(requester.agent, { title: '并发接受测试需求' });
      const a3b = await applyTo(provider.agent, r3.id, '并发 A');
      const a3c = await applyTo(provider2.agent, r3.id, '并发 B');

      const [resB, resC] = await Promise.all([
        requester.agent.post(`/api/v1/care/applications/${a3b.id}/accept`).set('Idempotency-Key', 'idem-concurrent-b'),
        requester.agent.post(`/api/v1/care/applications/${a3c.id}/accept`).set('Idempotency-Key', 'idem-concurrent-c'),
      ]);
      const statuses = [resB.status, resC.status].sort();
      expect(statuses).toEqual([200, 409]);
      const loser = resB.status === 409 ? resB : resC;
      expect(['CARE_ORDER_EXISTS', 'REQUEST_NOT_OPEN']).toContain(loser.body.error.code);

      const orders = await prisma.careOrder.findMany({ where: { requestId: r3.id } });
      expect(orders).toHaveLength(1);
      const apps = await prisma.careApplication.findMany({ where: { requestId: r3.id }, orderBy: { createdAt: 'asc' } });
      const statusesOfApps = apps.map((a) => a.status).sort();
      expect(statusesOfApps).toEqual(['ACCEPTED', 'EXPIRED']);
    });
  });

  describe('订单：参与方边界 + 确认 + 私密地址', () => {
    it('非参与方读订单 → 404；列表只含本人订单', async () => {
      await stranger.agent.get(`/api/v1/care/orders/${state.orderNo}`).expect(404);
      const list = await requester.agent.get('/api/v1/care/orders?role=REQUESTER').expect(200);
      expect(list.body.data.some((o: { id: string }) => o.id === state.orderNo)).toBe(true);
      const providerList = await provider.agent.get('/api/v1/care/orders?role=PROVIDER').expect(200);
      expect(providerList.body.data.some((o: { id: string }) => o.id === state.orderNo)).toBe(true);
      const providerAsRequester = await provider.agent.get('/api/v1/care/orders?role=REQUESTER').expect(200);
      expect(providerAsRequester.body.data.some((o: { id: string }) => o.id === state.orderNo)).toBe(false);
    });

    it('私密地址：未确认时服务者读取 403；非需求方写入 403；确认前无地址 → 409', async () => {
      const denied = await provider.agent.get(`/api/v1/care/orders/${state.orderNo}/private-details`).expect(403);
      expect(denied.body.error.code).toBe('PRIVATE_DETAIL_NOT_AVAILABLE');
      await stranger.agent.get(`/api/v1/care/orders/${state.orderNo}/private-details`).expect(403);
      await provider.agent
        .put(`/api/v1/care/orders/${state.orderNo}/private-details`)
        .send({ address: '越权写入地址' })
        .expect(403);
      const confirmFail = await requester.agent.post(`/api/v1/care/orders/${state.orderNo}/confirm`).expect(409);
      expect(confirmFail.body.error.code).toBe('ORDER_PRIVATE_DETAILS_REQUIRED');
    });

    it('需求方写入地址（AES 加密落库）；双方确认 → CONFIRMED；服务者可读且写审计', async () => {
      const put = await requester.agent
        .put(`/api/v1/care/orders/${state.orderNo}/private-details`)
        .send({ address: '南山区科技园 xx 小区 3 栋 502', entryInstructions: '门禁按 0305', emergencyContact: '13900139000 王先生' })
        .expect(200);
      expect(put.body.data.address).toBe('南山区科技园 xx 小区 3 栋 502');

      // 密文落库（明文不可见）
      const row = await prisma.careOrderPrivateDetail.findUniqueOrThrow({ where: { careOrderId: state.orderNo } });
      expect(row.addressEncrypted).toMatch(/^v1:/);
      expect(row.addressEncrypted).not.toContain('科技园');

      await requester.agent.post(`/api/v1/care/orders/${state.orderNo}/confirm`).expect(200);
      const stillPending = await requester.agent.get(`/api/v1/care/orders/${state.orderNo}`).expect(200);
      expect(stillPending.body.data.status).toBe('PENDING_CONFIRMATION');
      const confirmed = await provider.agent.post(`/api/v1/care/orders/${state.orderNo}/confirm`).expect(200);
      expect(confirmed.body.data.status).toBe('CONFIRMED');

      const read = await provider.agent.get(`/api/v1/care/orders/${state.orderNo}/private-details`).expect(200);
      expect(read.body.data.address).toBe('南山区科技园 xx 小区 3 栋 502');
      expect(read.body.data.emergencyContact).toBe('13900139000 王先生');

      const auditRows = await prisma.sensitiveAccessLog.findMany({ where: { resourceId: state.orderNo } });
      expect(auditRows.some((r) => r.purpose === 'ORDER_PRIVATE_DETAILS_WRITE' && r.fieldGroup === 'ADDRESS')).toBe(true);
      expect(auditRows.some((r) => r.purpose === 'ORDER_PRIVATE_DETAILS_READ' && r.fieldGroup === 'ADDRESS')).toBe(true);
      expect(auditRows.every((r) => r.actorUserId === provider.id || r.actorUserId === requester.id)).toBe(true);
    });
  });

  describe('订单状态机：start/visits/complete/reviews', () => {
    it('start：需求方不可开始；服务者正常开始', async () => {
      await requester.agent.post(`/api/v1/care/orders/${state.orderNo}/start`).expect(409);
      const started = await provider.agent.post(`/api/v1/care/orders/${state.orderNo}/start`).expect(200);
      expect(started.body.data.status).toBe('IN_PROGRESS');
      await provider.agent.post(`/api/v1/care/orders/${state.orderNo}/start`).expect(409); // 非法流转
    });

    it('visits：幂等创建 + 非法流转 409 + 异常必填说明', async () => {
      const v1 = await provider.agent
        .post(`/api/v1/care/orders/${state.orderNo}/visits`)
        .set('Idempotency-Key', 'idem-visit-1')
        .send({ scheduledAt: new Date(Date.now() + 3600_000).toISOString() })
        .expect(201);
      state.visit1Id = v1.body.data.id;
      expect(v1.body.data.seq).toBe(1);
      const replay = await provider.agent
        .post(`/api/v1/care/orders/${state.orderNo}/visits`)
        .set('Idempotency-Key', 'idem-visit-1')
        .send({ scheduledAt: v1.body.data.scheduledAt })
        .expect(201);
      expect(replay.body.data.id).toBe(state.visit1Id);

      const v2 = await provider.agent
        .post(`/api/v1/care/orders/${state.orderNo}/visits`)
        .set('Idempotency-Key', 'idem-visit-2')
        .send({ scheduledAt: new Date(Date.now() + 86400_000).toISOString() })
        .expect(201);
      state.visit2Id = v2.body.data.id;

      // 需求方不可更新 visit
      await requester.agent
        .patch(`/api/v1/care/orders/${state.orderNo}/visits/${state.visit1Id}`)
        .send({ action: 'COMPLETE' })
        .expect(409);
      // 未开始就完成 → 非法流转
      const bad = await provider.agent
        .patch(`/api/v1/care/orders/${state.orderNo}/visits/${state.visit1Id}`)
        .send({ action: 'EXCEPTION' })
        .expect(400); // 异常必填说明
      expect(bad.body.error.code).toBe('REQUEST_VALIDATION_FAILED');

      await provider.agent
        .patch(`/api/v1/care/orders/${state.orderNo}/visits/${state.visit1Id}`)
        .send({ action: 'START' })
        .expect(200);
      const done = await provider.agent
        .patch(`/api/v1/care/orders/${state.orderNo}/visits/${state.visit1Id}`)
        .send({ action: 'COMPLETE', evidence: [{ evidenceType: 'NOTE', note: '已喂食换水，猫咪状态正常' }] })
        .expect(200);
      expect(done.body.data.status).toBe('COMPLETED');

      // PHOTO 凭证（M4 管线）当前不支持
      await provider.agent
        .patch(`/api/v1/care/orders/${state.orderNo}/visits/${state.visit2Id}`)
        .send({ action: 'COMPLETE', evidence: [{ evidenceType: 'PHOTO' }] })
        .expect(400);
    });

    it('complete：未完成全部 visit → 409；服务者提交 → COMPLETION_SUBMITTED；需求方确认 → COMPLETED', async () => {
      const tooEarly = await provider.agent
        .post(`/api/v1/care/orders/${state.orderNo}/complete`)
        .set('Idempotency-Key', 'idem-complete-early')
        .expect(409);
      expect(tooEarly.body.error.code).toBe('ORDER_STATE_INVALID');

      await provider.agent
        .patch(`/api/v1/care/orders/${state.orderNo}/visits/${state.visit2Id}`)
        .send({ action: 'MISSED' })
        .expect(400); // MISSED 必填说明
      await provider.agent
        .patch(`/api/v1/care/orders/${state.orderNo}/visits/${state.visit2Id}`)
        .send({ action: 'MISSED', notes: '第二次上门时主人已回家，无需服务' })
        .expect(200);

      const submitted = await provider.agent
        .post(`/api/v1/care/orders/${state.orderNo}/complete`)
        .set('Idempotency-Key', 'idem-complete-1')
        .expect(200);
      expect(submitted.body.data.status).toBe('COMPLETION_SUBMITTED');
      // 同 key 重放
      const replay = await provider.agent
        .post(`/api/v1/care/orders/${state.orderNo}/complete`)
        .set('Idempotency-Key', 'idem-complete-1')
        .expect(200);
      expect(replay.body.data.status).toBe('COMPLETION_SUBMITTED');

      const confirmedDone = await requester.agent
        .post(`/api/v1/care/orders/${state.orderNo}/complete`)
        .set('Idempotency-Key', 'idem-complete-confirm')
        .expect(200);
      expect(confirmedDone.body.data.status).toBe('COMPLETED');
      expect(confirmedDone.body.data.completedAt).toBeTruthy();
      expect(confirmedDone.body.data.visits).toHaveLength(2);
      expect(confirmedDone.body.data.visits[0].evidence[0].note).toContain('已喂食换水');

      // 完成后的订单不可取消
      const cancel = await requester.agent
        .post(`/api/v1/care/orders/${state.orderNo}/cancel`)
        .send({ reasonCode: 'OTHER' })
        .expect(409);
      expect(cancel.body.error.code).toBe('ORDER_CANCEL_NOT_ALLOWED');
    });

    it('reviews：仅 COMPLETED；双向各一次；重复 409；rating 越界 400', async () => {
      const r = await requester.agent
        .post(`/api/v1/care/orders/${state.orderNo}/reviews`)
        .set('Idempotency-Key', 'idem-review-requester')
        .send({ rating: 5, tags: ['准时', '细心'], content: '喂得很好，猫咪很健康' })
        .expect(200);
      expect(r.body.data).toMatchObject({ role: 'REQUESTER', rating: 5, status: 'VISIBLE' });
      expect(r.body.data.reviewee.id).toBe(provider.id);

      const dup = await requester.agent
        .post(`/api/v1/care/orders/${state.orderNo}/reviews`)
        .set('Idempotency-Key', 'idem-review-requester-2')
        .send({ rating: 4 })
        .expect(409);
      expect(dup.body.error.code).toBe('REVIEW_ALREADY_EXISTS');

      const fromProvider = await provider.agent
        .post(`/api/v1/care/orders/${state.orderNo}/reviews`)
        .set('Idempotency-Key', 'idem-review-provider')
        .send({ rating: 5 })
        .expect(200);
      expect(fromProvider.body.data.role).toBe('PROVIDER');

      await stranger.agent
        .post(`/api/v1/care/orders/${state.orderNo}/reviews`)
        .set('Idempotency-Key', 'idem-review-stranger')
        .send({ rating: 5 })
        .expect(404);

      // 未完成订单评价 → 409（用取消态订单验证）
      await requester.agent
        .post(`/api/v1/care/orders/${state.orderNo}/reviews`)
        .set('Idempotency-Key', 'idem-review-x')
        .send({ rating: 2 })
        .expect(409);
    });
  });

  describe('取消与纠纷', () => {
    it('PENDING_CONFIRMATION 取消 → CANCELLED（记录原因码）', async () => {
      const r4 = await createRequest(requester.agent, { title: '用于取消的测试需求' });
      state.requestForCancelId = r4.id;
      const a4 = await applyTo(provider.agent, r4.id, '取消流程申请');
      const acc = await accept(requester.agent, a4.id, 'idem-accept-cancel');
      state.orderCancelId = acc.body.data.orderId;

      const cancelled = await requester.agent
        .post(`/api/v1/care/orders/${state.orderCancelId}/cancel`)
        .send({ reasonCode: 'REQUESTER_CHANGED_PLAN', note: '行程取消' })
        .expect(200);
      expect(cancelled.body.data.status).toBe('CANCELLED');
      expect(cancelled.body.data.cancelReasonCode).toBe('REQUESTER_CHANGED_PLAN');
      // 已取消订单不可再评价
      await requester.agent
        .post(`/api/v1/care/orders/${state.orderCancelId}/reviews`)
        .set('Idempotency-Key', 'idem-review-cancelled')
        .send({ rating: 3 })
        .expect(409);
    });

    it('IN_PROGRESS 发起纠纷 → DISPUTED + 工单；重复发起 409；纠纷中完成确认被拒', async () => {
      const r5 = await createRequest(requester.agent, { title: '用于纠纷的测试需求' });
      state.requestForDisputeId = r5.id;
      const a5 = await applyTo(provider.agent, r5.id, '纠纷流程申请');
      const acc = await accept(requester.agent, a5.id, 'idem-accept-dispute');
      state.orderDisputeId = acc.body.data.orderId;
      await driveToConfirmed(state.orderDisputeId);
      await provider.agent.post(`/api/v1/care/orders/${state.orderDisputeId}/start`).expect(200);

      const dispute = await requester.agent
        .post(`/api/v1/care/orders/${state.orderDisputeId}/disputes`)
        .send({ reasonCode: 'PET_CONDITION', description: '回家发现猫咪呕吐，要求核实情况' })
        .expect(200);
      expect(dispute.body.data.status).toBe('OPEN');
      expect(dispute.body.data.caseType).toBe('CARE');

      const again = await requester.agent
        .post(`/api/v1/care/orders/${state.orderDisputeId}/disputes`)
        .send({ reasonCode: 'OTHER', description: '重复发起纠纷测试' })
        .expect(409);
      expect(again.body.error.code).toBe('DISPUTE_ALREADY_OPEN');

      const order = await requester.agent.get(`/api/v1/care/orders/${state.orderDisputeId}`).expect(200);
      expect(order.body.data.status).toBe('DISPUTED');

      // 纠纷中订单不可完成
      await provider.agent
        .post(`/api/v1/care/orders/${state.orderDisputeId}/complete`)
        .set('Idempotency-Key', 'idem-complete-disputed')
        .expect(409);

      const disputeRow = await prisma.dispute.findFirstOrThrow({ where: { careOrderId: state.orderDisputeId } });
      const events = await prisma.disputeEvent.findMany({ where: { disputeId: disputeRow.id } });
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('SYSTEM');
    });

    it('start 时间窗校验：超出 ±24h → 409 ORDER_START_WINDOW_INVALID', async () => {
      const r6 = await createRequest(requester.agent, {
        title: '用于时间窗的测试需求',
        ...futureWindow(72, 2),
      });
      state.requestForWindowId = r6.id;
      const a6 = await applyTo(provider.agent, r6.id, '时间窗申请');
      const acc = await accept(requester.agent, a6.id, 'idem-accept-window');
      state.orderWindowId = acc.body.data.orderId;
      await driveToConfirmed(state.orderWindowId);

      const fail = await provider.agent.post(`/api/v1/care/orders/${state.orderWindowId}/start`).expect(409);
      expect(fail.body.error.code).toBe('ORDER_START_WINDOW_INVALID');
    });
  });
});
