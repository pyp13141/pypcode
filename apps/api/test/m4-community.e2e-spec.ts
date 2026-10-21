import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { promises as fs } from 'node:fs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * M4 社区/消息/通知/举报集成测试：
 * - 信息流可见性（公开/关注/私密、屏蔽双向、个人隐藏、审核态）
 * - 发帖机审路由（风险关键词→人工）、评论两级、互动幂等、关注通知
 * - 求助帖白名单与状态流转、榜单规则、徽章发放
 * - 会话消息（限流可由运营配置覆盖、关键词风险提醒）、会话举报
 * - 举报工单与重复合并、我的通知与已读
 */
describe('M4 community e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  type Agent = ReturnType<typeof request.agent>;
  const author = { agent: null as unknown as Agent, id: '' };
  const reader = { agent: null as unknown as Agent, id: '' };
  const other = { agent: null as unknown as Agent, id: '' };
  const muter = { agent: null as unknown as Agent, id: '' };

  const state: { postId: string; riskyPostId: string; helpPostId: string; helpPost2Id: string; conversationId: string } = {} as never;

  async function loginWechat(code: string) {
    const res = await request(app.getHttpServer()).post('/api/v1/auth/wechat/login').send({ code }).expect(200);
    return { agent: request.agent(app.getHttpServer()).set('Authorization', `Bearer ${res.body.data.accessToken}`), id: res.body.data.user.id as string };
  }

  /** 把账号"变老"（绕过新号 24h 人工审核，模拟成熟账号；新号行为单独测） */
  async function ageAccount(userId: string, hours = 48) {
    await prisma.user.update({ where: { id: userId }, data: { createdAt: new Date(Date.now() - hours * 3600_000) } });
  }

  async function createPost(agent: Agent, content: string, images: string[] = []) {
    const res = await agent.post('/api/v1/community/posts').send({ content, ...(images.length ? { images } : {}) }).expect(201);
    return res.body.data as { id: string; moderationStatus: string };
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
      'TRUNCATE TABLE posts, comments, post_hides, follows, reports, notifications, help_posts, conversations, market_deals, market_listings, media_assets, disputes, user_badges, moderation_actions, app_settings, care_orders, care_requests, care_offerings, reactions, reviews, sensitive_access_logs, idempotency_records CASCADE',
    );

    const a = await loginWechat('m4-author');
    const r = await loginWechat('m4-reader');
    const o = await loginWechat('m4-other');
    const m = await loginWechat('m4-muter');
    author.agent = a.agent; author.id = a.id;
    reader.agent = r.agent; reader.id = r.id;
    other.agent = o.agent; other.id = o.id;
    muter.agent = m.agent; muter.id = m.id;
    await ageAccount(author.id);
    await ageAccount(reader.id);
    await ageAccount(other.id);
    await ageAccount(muter.id);
    // 预热运营配置（SettingsService 有 30s 缓存，须在首个消息发送前写入）
    await prisma.appSetting.upsert({
      where: { key: 'risk-rules' },
      create: { key: 'risk-rules', valueJson: { messagePerMinute: 2 } },
      update: { valueJson: { messagePerMinute: 2 } },
    });
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE posts, comments, post_hides, follows, reports, notifications, help_posts, conversations, market_deals, market_listings, media_assets, disputes, user_badges, moderation_actions, app_settings, reactions CASCADE',
    );
    await fs.rm(process.env.MEDIA_DIR!, { recursive: true, force: true });
    await app.close();
  });

  describe('发帖与信息流', () => {
    it('成熟账号正常内容 → APPROVED 并进入公开信息流；新账号 → PENDING', async () => {
      const post = await createPost(author.agent, '今天带猫去打疫苗，非常配合，记录一下');
      state.postId = post.id;
      expect(post.moderationStatus).toBe('APPROVED');

      const feed = await request(app.getHttpServer()).get('/api/v1/community/feed?tab=latest').expect(200);
      expect(feed.body.data.some((p: { id: string }) => p.id === state.postId)).toBe(true);

      // 新账号（未变老）发帖 → 人工审核
      const newbie = await loginWechat('m4-newbie');
      const newbiePost = await createPost(newbie.agent, '新号第一条内容');
      expect(newbiePost.moderationStatus).toBe('PENDING');
      const publicFeed = await request(app.getHttpServer()).get('/api/v1/community/feed?tab=latest').expect(200);
      expect(publicFeed.body.data.some((p: { id: string }) => p.id === newbiePost.id)).toBe(false);
    });

    it('风险关键词（加微信/转账）→ PENDING 人工审核；详情仅作者可见', async () => {
      const risky = await createPost(author.agent, '低价出猫粮，有意加微信私聊，支持转账');
      state.riskyPostId = risky.id;
      expect(risky.moderationStatus).toBe('PENDING');

      await request(app.getHttpServer()).get(`/api/v1/community/posts/${risky.id}`).expect(404);
      const mine = await author.agent.get(`/api/v1/community/posts/${risky.id}`).expect(200);
      expect(mine.body.data.post.isOwner).toBe(true);
    });

    it('feed：following 需登录并只出已关注作者；hide 仅影响本人；屏蔽双向过滤（专用用户，不污染其他用例）', async () => {
      await request(app.getHttpServer()).get('/api/v1/community/feed?tab=following').expect(401);
      const beforeFollow = await reader.agent.get('/api/v1/community/feed?tab=following').expect(200);
      expect(beforeFollow.body.data.some((p: { id: string }) => p.id === state.postId)).toBe(false);

      await reader.agent.put(`/api/v1/community/users/${author.id}/follow`).expect(200);
      const afterFollow = await reader.agent.get('/api/v1/community/feed?tab=following').expect(200);
      expect(afterFollow.body.data.some((p: { id: string }) => p.id === state.postId)).toBe(true);

      // muter 隐藏该帖：仅 muter 的信息流看不到，其他人不受影响
      await muter.agent.post(`/api/v1/community/posts/${state.postId}/hide`).expect(200);
      const hidden = await muter.agent.get('/api/v1/community/feed?tab=latest').expect(200);
      expect(hidden.body.data.some((p: { id: string }) => p.id === state.postId)).toBe(false);
      const stillVisibleForOther = await other.agent.get('/api/v1/community/feed?tab=latest').expect(200);
      expect(stillVisibleForOther.body.data.some((p: { id: string }) => p.id === state.postId)).toBe(true);

      // 屏蔽作者（双向过滤）：作者内容对 blocker 不可见，解除后恢复
      await muter.agent.put(`/api/v1/me/blocks/${author.id}`).expect(200);
      const afterBlock = await muter.agent.get('/api/v1/community/feed?tab=latest').expect(200);
      expect(afterBlock.body.data.some((p: { id: string }) => p.id === state.postId)).toBe(false);
      await muter.agent.delete(`/api/v1/me/blocks/${author.id}`).expect(200);
      // 解除屏蔽后仍因本人 hide 偏好不可见（两种过滤相互独立）
      const stillHidden = await muter.agent.get('/api/v1/community/feed?tab=latest').expect(200);
      expect(stillHidden.body.data.some((p: { id: string }) => p.id === state.postId)).toBe(false);
      const visibleForCleanUser = await reader.agent.get('/api/v1/community/feed?tab=latest').expect(200);
      expect(visibleForCleanUser.body.data.some((p: { id: string }) => p.id === state.postId)).toBe(true);
    });
  });

  describe('评论/互动/关注', () => {
    let commentId = '';
    let replyId = '';

    it('评论与两级回复；三级回复拒绝；通知帖主/被回复人', async () => {
      const c1 = await reader.agent.post(`/api/v1/community/posts/${state.postId}/comments`).send({ content: '猫咪好乖！' }).expect(201);
      commentId = c1.body.data.id;
      const c2 = await author.agent
        .post(`/api/v1/community/posts/${state.postId}/comments`)
        .send({ content: '谢谢，它平时也很听话', parentId: commentId })
        .expect(201);
      replyId = c2.body.data.id;
      const bad = await reader.agent
        .post(`/api/v1/community/posts/${state.postId}/comments`)
        .send({ content: '三级回复', parentId: replyId })
        .expect(400);
      expect(bad.body.error.code).toBe('REQUEST_VALIDATION_FAILED');

      const authorNotifications = await author.agent.get('/api/v1/notifications?unreadOnly=true').expect(200);
      expect(authorNotifications.body.data.some((n: { type: string }) => n.type === 'POST_COMMENTED')).toBe(true);
      const readerNotifications = await reader.agent.get('/api/v1/notifications').expect(200);
      expect(readerNotifications.body.data.some((n: { type: string }) => n.type === 'COMMENT_REPLIED')).toBe(true);
      // 作者收到评论通知（上一条订阅在隐藏/屏蔽测试前已创建）
    });

    it('评论编辑/删除仅作者；软删后不在详情出现', async () => {
      await author.agent.patch(`/api/v1/community/comments/${commentId}`).send({ content: '篡改' }).expect(404);
      await reader.agent.patch(`/api/v1/community/comments/${commentId}`).send({ content: '改成这样' }).expect(200);
      await reader.agent.delete(`/api/v1/community/comments/${commentId}`).expect(200);
      const detail = await request(app.getHttpServer()).get(`/api/v1/community/posts/${state.postId}`).expect(200);
      expect(detail.body.data.comments.some((c: { id: string }) => c.id === commentId)).toBe(false);
      expect(detail.body.data.comments.some((c: { id: string }) => c.id === replyId)).toBe(true);
    });

    it('点赞/收藏幂等 + 取消；目标不存在 404', async () => {
      const like1 = await reader.agent
        .post('/api/v1/community/reactions')
        .send({ targetType: 'POST', targetId: state.postId, reactionType: 'LIKE' })
        .expect(201);
      expect(like1.body.data).toMatchObject({ reacted: true, count: 1 });
      const like2 = await reader.agent
        .post('/api/v1/community/reactions')
        .send({ targetType: 'POST', targetId: state.postId, reactionType: 'LIKE' })
        .expect(201);
      expect(like2.body.data.count).toBe(1);

      const fav = await other.agent
        .post('/api/v1/community/reactions')
        .send({ targetType: 'POST', targetId: state.postId, reactionType: 'FAVORITE' })
        .expect(201);
      expect(fav.body.data.count).toBe(1);

      const unLike = await reader.agent
        .delete('/api/v1/community/reactions')
        .send({ targetType: 'POST', targetId: state.postId, reactionType: 'LIKE' })
        .expect(200);
      expect(unLike.body.data).toMatchObject({ reacted: false, count: 0 });

      await other.agent
        .post('/api/v1/community/reactions')
        .send({ targetType: 'POST', targetId: '00000000-0000-4000-8000-000000000000', reactionType: 'LIKE' })
        .expect(404);
    });

    it('关注：禁自关注 400；幂等；被关注人收到通知', async () => {
      const self = await reader.agent.put(`/api/v1/community/users/${reader.id}/follow`).expect(400);
      expect(self.body.error.code).toBe('SELF_FOLLOW_NOT_ALLOWED');
      await other.agent.put(`/api/v1/community/users/${author.id}/follow`).expect(200);
      await other.agent.put(`/api/v1/community/users/${author.id}/follow`).expect(200);
      const notifications = await author.agent.get('/api/v1/notifications').expect(200);
      const followNotices = notifications.body.data.filter((n: { type: string }) => n.type === 'NEW_FOLLOWER');
      expect(followNotices.length).toBeGreaterThanOrEqual(2); // reader + other 各一次
      const unfollow = await other.agent.delete(`/api/v1/community/users/${author.id}/follow`).expect(200);
      expect(unfollow.body.data.following).toBe(false);
    });

    it('徽章：首发帖获得 COMMUNITY_FIRST；定义公开可见', async () => {
      const badges = await author.agent.get('/api/v1/badges').expect(200);
      expect(badges.body.data.definitions.length).toBeGreaterThan(0);
      expect(badges.body.data.earned.some((b: { code: string }) => b.code === 'COMMUNITY_FIRST')).toBe(true);
      const anonymous = await request(app.getHttpServer()).get('/api/v1/badges').expect(200);
      expect(anonymous.body.data.definitions.length).toBeGreaterThan(0);
      expect(anonymous.body.data.earned).toHaveLength(0);
    });

    it('榜单：content 榜含加分内容；规则随响应下发；growth 为空榜', async () => {
      const content = await request(app.getHttpServer()).get('/api/v1/community/leaderboards?type=content').expect(200);
      expect(content.body.data.rule).toBeTruthy();
      expect(content.body.data.entries.some((e: { postId: string }) => e.postId === state.postId)).toBe(true);
      // M6 起 growth 榜已接线（近 30 天健康/情绪记录数），此前的空榜断言随之更新
      const growth = await request(app.getHttpServer()).get('/api/v1/community/leaderboards?type=growth').expect(200);
      expect(growth.body.data.rule).toContain('近 30 天');
      expect(Array.isArray(growth.body.data.entries)).toBe(true);
      const contribution = await request(app.getHttpServer()).get('/api/v1/community/leaderboards?type=contribution').expect(200);
      expect(Array.isArray(contribution.body.data.entries)).toBe(true);
    });
  });

  describe('通用求助帖（D-010）', () => {
    it('分类白名单 + 发布/检索/详情；非法分类 400', async () => {
      const bad = await reader.agent
        .post('/api/v1/community/help-posts')
        .send({ category: 'ERRAND', title: '帮忙跑腿取快递', content: '收费代取' })
        .expect(400);
      expect(bad.body.error.code).toBe('HELP_CATEGORY_NOT_ALLOWED');

      const created = await reader.agent
        .post('/api/v1/community/help-posts')
        .send({ category: 'NEIGHBOR', title: '周末谁家有多余的猫砂铲', content: '想借一把用两天，附近可自取', deadlineAt: new Date(Date.now() + 86400_000).toISOString() })
        .expect(201);
      state.helpPostId = created.body.data.id;
      expect(created.body.data.status).toBe('OPEN');

      const list = await request(app.getHttpServer()).get('/api/v1/community/help-posts?category=NEIGHBOR').expect(200);
      expect(list.body.data.some((h: { id: string }) => h.id === state.helpPostId)).toBe(true);

      const detail = await request(app.getHttpServer()).get(`/api/v1/community/help-posts/${state.helpPostId}`).expect(200);
      expect(detail.body.data.helpPost.title).toContain('猫砂铲');
    });

    it('评论复用帖子评论；resolve/cancel 仅发帖人且幂等', async () => {
      await author.agent
        .post(`/api/v1/community/posts/${(await prisma.helpPost.findUniqueOrThrow({ where: { id: state.helpPostId } })).postId}/comments`)
        .send({ content: '我家有，可以借你' })
        .expect(201);

      await other.agent.post(`/api/v1/community/help-posts/${state.helpPostId}/resolve`).expect(404);
      const resolved = await reader.agent.post(`/api/v1/community/help-posts/${state.helpPostId}/resolve`).expect(200);
      expect(resolved.body.data.status).toBe('RESOLVED');
      const again = await reader.agent.post(`/api/v1/community/help-posts/${state.helpPostId}/resolve`).expect(200);
      expect(again.body.data.status).toBe('RESOLVED'); // 幂等

      const created2 = await reader.agent
        .post('/api/v1/community/help-posts')
        .send({ category: 'PET_CARE', title: '求推荐附近靠谱宠物医院', content: '第一次养猫想找医院做绝育' })
        .expect(201);
      state.helpPost2Id = created2.body.data.id;
      const closed = await reader.agent.post(`/api/v1/community/help-posts/${state.helpPost2Id}/cancel`).expect(200);
      expect(closed.body.data.status).toBe('CLOSED');
    });
  });

  describe('会话消息与举报', () => {
    it('夹具：一个交易会话；非参与方读写 404；风险关键词随消息返回 riskTip', async () => {
      const listing = await prisma.marketListing.create({
        data: {
          sellerUserId: author.id,
          listingType: 'GIFT',
          categoryId: (await prisma.marketCategory.findFirstOrThrow({ where: { code: 'TOYS' } })).id,
          title: '会话测试物品',
          description: 'x',
          areaCode: '440305',
          status: 'PUBLISHED',
        },
      });
      const dealRes = await reader.agent.post('/api/v1/market/deals').send({ listingId: listing.id, message: '你好，想要' }).expect(201);
      state.conversationId = dealRes.body.data.conversationId;
      expect(state.conversationId).toBeTruthy();

      await author.agent.get(`/api/v1/conversations/${state.conversationId}/messages`).expect(200);
      await other.agent.get(`/api/v1/conversations/${state.conversationId}/messages`).expect(404);

      const risky = await reader.agent
        .post(`/api/v1/conversations/${state.conversationId}/messages`)
        .send({ content: '方便的话加微信转账给你' })
        .expect(201);
      expect(risky.body.data.riskTip).toBeTruthy();

      // 会话首条消息通知了卖家
      const sellerNotices = await author.agent.get('/api/v1/notifications').expect(200);
      expect(sellerNotices.body.data.some((n: { type: string }) => n.type === 'NEW_MESSAGE')).toBe(true);
    });

    it('限流可由运营配置覆盖（beforeAll 预热 risk-rules.messagePerMinute=2）', async () => {
      // 清掉 1 分钟内的历史消息，避免干扰
      await prisma.message.deleteMany({ where: { senderUserId: reader.id } });
      await reader.agent.post(`/api/v1/conversations/${state.conversationId}/messages`).send({ content: '第一条' }).expect(201);
      await reader.agent.post(`/api/v1/conversations/${state.conversationId}/messages`).send({ content: '第二条' }).expect(201);
      const blocked = await reader.agent.post(`/api/v1/conversations/${state.conversationId}/messages`).send({ content: '第三条' }).expect(429);
      expect(blocked.body.error.code).toBe('RATE_LIMITED');
    });

    it('会话举报：参与方可举报；重复举报合并 409', async () => {
      const report = await reader.agent
        .post(`/api/v1/conversations/${state.conversationId}/report`)
        .send({ reason: 'HARASSMENT', details: '对方持续骚扰' })
        .expect(200);
      expect(report.body.data.targetType).toBe('CONVERSATION');
      const dup = await reader.agent
        .post(`/api/v1/conversations/${state.conversationId}/report`)
        .send({ reason: 'SCAM', details: '重复举报' })
        .expect(409);
      expect(dup.body.error.code).toBe('REPORT_DUPLICATE');
    });
  });

  describe('举报与通知', () => {
    it('举报帖子：创建 NEW；重复 409；GET /me/reports 可见；目标不存在 404', async () => {
      const report = await other.agent
        .post('/api/v1/reports')
        .send({ targetType: 'POST', targetId: state.postId, reason: 'MISINFO', details: '内容疑似夸大' })
        .expect(201);
      expect(report.body.data.status).toBe('NEW');

      const dup = await other.agent
        .post('/api/v1/reports')
        .send({ targetType: 'POST', targetId: state.postId, reason: 'OTHER' })
        .expect(409);
      expect(dup.body.error.code).toBe('REPORT_DUPLICATE');

      const mine = await other.agent.get('/api/v1/me/reports').expect(200);
      expect(mine.body.data.some((r: { id: string }) => r.id === report.body.data.id)).toBe(true);

      await other.agent
        .post('/api/v1/reports')
        .send({ targetType: 'USER', targetId: '00000000-0000-4000-8000-000000000000', reason: 'OTHER' })
        .expect(404);
    });

    it('通知：列表/未读过滤/已读幂等/他人通知 404', async () => {
      const list = await author.agent.get('/api/v1/notifications').expect(200);
      expect(list.body.data.length).toBeGreaterThan(0);
      expect(list.body.meta.page).toBe(1);
      const unread = await author.agent.get('/api/v1/notifications?unreadOnly=true').expect(200);
      const target = unread.body.data[0];
      expect(target).toBeTruthy();

      await author.agent.post(`/api/v1/notifications/${target.id}/read`).expect(200);
      await author.agent.post(`/api/v1/notifications/${target.id}/read`).expect(200); // 幂等
      const after = await author.agent.get('/api/v1/notifications?unreadOnly=true').expect(200);
      expect(after.body.data.some((n: { id: string }) => n.id === target.id)).toBe(false);

      await other.agent.post(`/api/v1/notifications/${target.id}/read`).expect(404);
    });
  });
});
