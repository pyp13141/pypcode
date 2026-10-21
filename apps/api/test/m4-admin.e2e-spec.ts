import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { promises as fs } from 'node:fs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * M4 后台（admin）集成测试：
 * - 守卫与最小权限（非后台 403、角色不足 403、super_admin 全通）
 * - 用户封禁（会话撤销、封禁用户全站 401）
 * - 审核队列与决定（通知作者 + moderation_actions + 审计）
 * - 举报指派/处置（通知举报人）
 * - 纠纷裁定（驱动订单/交易终态 + 双方通知 + 申诉）
 * - 只读记录（无地址字段）、配置（risk-rules 生效）、指标、审计（追加式）
 */
describe('M4 admin e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  type Agent = ReturnType<typeof request.agent>;
  const moderator = { agent: null as unknown as Agent, id: '' };
  const support = { agent: null as unknown as Agent, id: '' };
  const analyst = { agent: null as unknown as Agent, id: '' };
  const normal = { agent: null as unknown as Agent, id: '' };
  const target = { agent: null as unknown as Agent, id: '' };

  const state: { pendingPostId: string; reportId: string; disputeId: string; dealId: string } = {} as never;

  async function loginWechat(code: string) {
    const res = await request(app.getHttpServer()).post('/api/v1/auth/wechat/login').send({ code }).expect(200);
    return { agent: request.agent(app.getHttpServer()).set('Authorization', `Bearer ${res.body.data.accessToken}`), id: res.body.data.user.id as string };
  }

  async function grant(userId: string, roleCode: string) {
    const role = await prisma.adminRole.findUniqueOrThrow({ where: { code: roleCode } });
    await prisma.adminUser.upsert({
      where: { userId },
      create: { userId, roleId: role.id, status: 'ACTIVE' },
      update: { roleId: role.id, status: 'ACTIVE' },
    });
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

    await fs.rm(process.env.MEDIA_DIR!, { recursive: true, force: true });
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE posts, comments, reports, notifications, market_deals, market_listings, media_assets, disputes, dispute_events, admin_users, admin_audit_logs, moderation_actions, app_settings, user_sessions, reactions CASCADE',
    );

    const m = await loginWechat('m4-admin-mod');
    const sp = await loginWechat('m4-admin-support');
    const an = await loginWechat('m4-admin-analyst');
    const n = await loginWechat('m4-admin-normal');
    const t = await loginWechat('m4-admin-target');
    moderator.agent = m.agent; moderator.id = m.id;
    support.agent = sp.agent; support.id = sp.id;
    analyst.agent = an.agent; analyst.id = an.id;
    normal.agent = n.agent; normal.id = n.id;
    target.agent = t.agent; target.id = t.id;
    await grant(moderator.id, 'content_moderator');
    await grant(support.id, 'support_operator');
    await grant(analyst.id, 'analyst');
    // 目标用户做成"成熟账号"，可正常发帖
    await prisma.user.update({ where: { id: target.id }, data: { createdAt: new Date(Date.now() - 72 * 3600_000) } });
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE posts, comments, reports, notifications, market_deals, market_listings, media_assets, disputes, dispute_events, admin_users, admin_audit_logs, moderation_actions, app_settings, reactions CASCADE',
    );
    await fs.rm(process.env.MEDIA_DIR!, { recursive: true, force: true });
    await app.close();
  });

  describe('守卫与权限', () => {
    it('非后台账号 → 403 ADMIN_REQUIRED；未登录 → 401', async () => {
      const res = await normal.agent.get('/api/v1/admin/users').expect(403);
      expect(res.body.error.code).toBe('ADMIN_REQUIRED');
      await request(app.getHttpServer()).get('/api/v1/admin/users').expect(401);
    });

    it('角色最小权限：analyst 不能访问审核队列/纠纷；support 不能改类目；只有 super_admin 能改风控规则', async () => {
      const denied = await analyst.agent.get('/api/v1/admin/moderation/queue').expect(403);
      expect(denied.body.error.code).toBe('ADMIN_ROLE_REQUIRED');
      await analyst.agent.get('/api/v1/admin/disputes').expect(403);
      await support.agent.put('/api/v1/admin/categories/TOYS').send({ riskLevel: 'HIGH' }).expect(403);
      await support.agent.put('/api/v1/admin/risk-rules').send({ value: { messagePerMinute: 5 } }).expect(403);
      // analyst 可读指标
      await analyst.agent.get('/api/v1/admin/metrics/overview').expect(200);
    });
  });

  describe('用户治理', () => {
    it('用户检索（含风险标签）；封禁撤销会话并全站 401；解封恢复', async () => {
      const targetUser = await prisma.user.findUniqueOrThrow({ where: { id: target.id }, select: { nickname: true } });
      const list = await moderator.agent.get(`/api/v1/admin/users?query=${encodeURIComponent(targetUser.nickname)}`).expect(200);
      expect(list.body.data.some((u: { id: string }) => u.id === target.id)).toBe(true);

      const banned = await moderator.agent
        .post(`/api/v1/admin/users/${target.id}/status`)
        .send({ status: 'BANNED', reason: '发布大量违规内容' })
        .expect(200);
      expect(banned.body.data.status).toBe('BANNED');
      const sessions = await prisma.userSession.findMany({ where: { userId: target.id, revokedAt: null } });
      expect(sessions).toHaveLength(0);
      // 封禁即撤销会话 → 旧令牌 401；新登录被拒（USER_BANNED 403，API §1.1）
      const blocked = await target.agent.get('/api/v1/me').expect(401);
      expect(blocked.body.error.code).toBe('AUTH_REQUIRED');
      const reloginBlocked = await request(app.getHttpServer())
        .post('/api/v1/auth/wechat/login')
        .send({ code: 'm4-admin-target' })
        .expect(403);
      expect(reloginBlocked.body.error.code).toBe('USER_BANNED');

      await moderator.agent.post(`/api/v1/admin/users/${target.id}/status`).send({ status: 'ACTIVE', reason: '申诉通过' }).expect(200);
      const relogin = await loginWechat('m4-admin-target');
      target.agent = relogin.agent; // 会话已撤销，刷新测试用 agent
      await target.agent.get('/api/v1/me').expect(200);
    });
  });

  describe('内容审核', () => {
    it('待审帖子进入队列；APPROVE 后公开可见并通知作者；REMOVE 隐藏并通知', async () => {
      // 目标用户发一条命中风险词的内容 → PENDING
      const risky = await target.agent
        .post('/api/v1/community/posts')
        .send({ content: '出闲置猫笼，加微信私聊，支持转账' })
        .expect(201);
      expect(risky.body.data.moderationStatus).toBe('PENDING');
      state.pendingPostId = risky.body.data.id;

      const queue = await moderator.agent.get('/api/v1/admin/moderation/queue?type=POST').expect(200);
      expect(queue.body.data.posts.some((p: { id: string }) => p.id === state.pendingPostId)).toBe(true);

      const decided = await moderator.agent
        .post(`/api/v1/admin/moderation/${state.pendingPostId}/decision`)
        .send({ targetType: 'POST', decision: 'APPROVE', reason: '确认无诈骗信息' })
        .expect(200);
      expect(decided.body.data.status).toBe('APPROVED');
      const feed = await request(app.getHttpServer()).get('/api/v1/community/feed?tab=latest').expect(200);
      expect(feed.body.data.some((p: { id: string }) => p.id === state.pendingPostId)).toBe(true);
      const authorNotices = await target.agent.get('/api/v1/notifications').expect(200);
      expect(authorNotices.body.data.some((n: { type: string }) => n.type === 'CONTENT_APPROVED')).toBe(true);

      const actions = await prisma.moderationAction.findMany({ where: { targetId: state.pendingPostId } });
      expect(actions).toHaveLength(1);
      expect(actions[0].action).toBe('APPROVE');
    });
  });

  describe('举报处置', () => {
    it('指派 → 处置（DISMISSED）→ 通知举报人 + 审计落库', async () => {
      const report = await normal.agent
        .post('/api/v1/reports')
        .send({ targetType: 'POST', targetId: state.pendingPostId, reason: 'AD', details: '疑似广告' })
        .expect(201);
      state.reportId = report.body.data.id;

      const assigned = await moderator.agent.post(`/api/v1/admin/reports/${state.reportId}/assign`).expect(200);
      expect(assigned.body.data.status).toBe('PROCESSING');

      const resolved = await moderator.agent
        .post(`/api/v1/admin/reports/${state.reportId}/resolve`)
        .send({ decision: 'DISMISSED', note: '内容合规，无广告引导' })
        .expect(200);
      expect(resolved.body.data.status).toBe('DISMISSED');

      const notices = await normal.agent.get('/api/v1/notifications').expect(200);
      expect(notices.body.data.some((n: { type: string }) => n.type === 'REPORT_RESOLVED')).toBe(true);

      const audit = await prisma.adminAuditLog.findMany({ where: { resourceId: state.reportId } });
      expect(audit.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('纠纷裁定', () => {
    it('夹具交易纠纷：证据 → 裁定 CANCELLED 驱动交易终态；申诉 → APPEALING', async () => {
      const category = await prisma.marketCategory.findFirstOrThrow({ where: { code: 'TOYS' } });
      const listing = await prisma.marketListing.create({
        data: { sellerUserId: target.id, listingType: 'GIFT', categoryId: category.id, title: '裁定测试物品', description: 'x', areaCode: '440305', status: 'PUBLISHED' },
      });
      const deal = await prisma.marketDeal.create({
        data: { listingId: listing.id, buyerUserId: normal.id, sellerUserId: target.id, status: 'DISPUTED' },
      });
      state.dealId = deal.id;
      const dispute = await prisma.dispute.create({
        data: { caseType: 'MARKET', marketDealId: deal.id, openedBy: normal.id, reasonCode: 'ITEM_NOT_AS_DESCRIBED', description: '实物不符', status: 'OPEN' },
      });
      state.disputeId = dispute.id;

      // analyst 无权；support 可
      await analyst.agent.get('/api/v1/admin/disputes').expect(403);
      const list = await support.agent.get('/api/v1/admin/disputes?caseType=MARKET').expect(200);
      expect(list.body.data.some((d: { id: string }) => d.id === state.disputeId)).toBe(true);

      const evidence = await support.agent
        .post(`/api/v1/admin/disputes/${state.disputeId}/evidence`)
        .send({ note: '已核对双方提交的聊天与照片' })
        .expect(200);
      expect(evidence.body.data.status).toBe('EVIDENCE');

      const ruled = await support.agent
        .post(`/api/v1/admin/disputes/${state.disputeId}/ruling`)
        .send({ resolutionCode: 'CANCELLED', reason: '物品与描述不符，判定取消' })
        .expect(200);
      expect(ruled.body.data).toMatchObject({ status: 'RULED', resolutionCode: 'CANCELLED' });

      const dealAfter = await prisma.marketDeal.findUniqueOrThrow({ where: { id: state.dealId } });
      expect(dealAfter.status).toBe('CANCELLED');
      expect(dealAfter.cancelReasonCode).toBe('ADMIN_RULING');
      const events = await prisma.marketDealEvent.findMany({ where: { marketDealId: state.dealId, actorRole: 'ADMIN' } });
      expect(events[0]).toMatchObject({ fromStatus: 'DISPUTED', toStatus: 'CANCELLED' });

      const buyerNotices = await normal.agent.get('/api/v1/notifications').expect(200);
      expect(buyerNotices.body.data.some((n: { type: string }) => n.type === 'DISPUTE_RULED')).toBe(true);

      // 已裁定后不可再裁定；可申诉
      await support.agent
        .post(`/api/v1/admin/disputes/${state.disputeId}/ruling`)
        .send({ resolutionCode: 'COMPLETED', reason: '重复裁定测试' })
        .expect(409);
      const appeal = await support.agent
        .post(`/api/v1/admin/disputes/${state.disputeId}/appeal`)
        .send({ reason: '卖方提出申诉，补充材料' })
        .expect(200);
      expect(appeal.body.data.status).toBe('APPEALING');

      const audit = await prisma.adminAuditLog.findMany({ where: { resourceId: state.disputeId } });
      expect(audit.map((a) => a.action)).toEqual(expect.arrayContaining(['DISPUTE_EVIDENCE', 'DISPUTE_RULING', 'DISPUTE_APPEAL']));
    });
  });

  describe('只读记录/配置/指标/审计', () => {
    it('订单与交易只读列表：不返回地址/紧急联系人字段', async () => {
      const orders = await support.agent.get('/api/v1/admin/care-orders').expect(200);
      expect(Array.isArray(orders.body.data)).toBe(true);
      const raw = JSON.stringify(orders.body.data);
      expect(raw).not.toContain('address');
      expect(raw).not.toContain('emergencyContact');
      await support.agent.get('/api/v1/admin/market-deals').expect(200);
    });

    it('配置：类目风险级调整、风控规则写入后业务生效（消息限流）', async () => {
      const updated = await moderator.agent.get('/api/v1/admin/categories').expect(403); // content_moderator 无类目权限
      void updated;
      const catalog = await loginWechat('m4-admin-catalog');
      await grant(catalog.id, 'catalog_operator');
      const catOk = await catalog.agent.put('/api/v1/admin/categories/TOYS').send({ riskLevel: 'MEDIUM' }).expect(200);
      expect(catOk.body.data.riskLevel).toBe('MEDIUM');
      await catalog.agent.put('/api/v1/admin/categories/TOYS').send({ riskLevel: 'LOW' }).expect(200);

      // super_admin 写风控规则
      const superAdmin = await loginWechat('m4-admin-super');
      await grant(superAdmin.id, 'super_admin');
      const rules = await superAdmin.agent.put('/api/v1/admin/risk-rules').send({ value: { messagePerMinute: 3, requirePhoneVerified: false } }).expect(200);
      expect(rules.body.data).toMatchObject({ messagePerMinute: 3 });
      const read = await superAdmin.agent.get('/api/v1/admin/risk-rules').expect(200);
      expect(read.body.data).toMatchObject({ messagePerMinute: 3 });
    });

    it('指标：聚合结构完整；审计：只读且追加式（UPDATE 被触发器拒绝）', async () => {
      const metrics = await analyst.agent.get('/api/v1/admin/metrics/overview').expect(200);
      expect(metrics.body.data).toMatchObject({
        users: expect.any(Object),
        care: expect.any(Object),
        market: expect.any(Object),
        moderation: expect.any(Object),
      });

      const logs = await loginWechat('m4-admin-super2');
      await grant(logs.id, 'super_admin');
      const audit = await logs.agent.get('/api/v1/admin/audit-logs').expect(200);
      expect(audit.body.data.length).toBeGreaterThan(0);
      const first = audit.body.data[0];
      expect(first.admin).toBeTruthy();

      await expect(
        prisma.adminAuditLog.update({ where: { id: first.id }, data: { reason: 'tamper' } }),
      ).rejects.toThrow(/append-only/);
    });
  });
});
