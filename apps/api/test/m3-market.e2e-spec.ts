import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { promises as fs } from 'node:fs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * M3 集市与媒体管线集成测试：
 * - 媒体：授权（类型/大小/频控）→ 直传 → finalize → 签名读取与业务授权
 * - 列表：价格与交易类型一致、HIGH 风险类目人审、公开视图可见性、收藏幂等
 * - 交易：一物一单（跨买家互斥 + 交接原子关闭 + 竞品交易自动终结）、状态机、纠纷、评价
 * 独立测试库 + 临时媒体目录，不依赖外网。
 */
describe('M3 market e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  type Agent = ReturnType<typeof request.agent>;
  const seller = { agent: null as unknown as Agent, id: '' };
  const buyer = { agent: null as unknown as Agent, id: '' };
  const buyer2 = { agent: null as unknown as Agent, id: '' };
  const stranger = { agent: null as unknown as Agent, id: '' };

  const state: {
    mediaIds: string[];
    listingId: string;
    listingHighRiskId: string;
    dealId: string;
    deal2Id: string;
    dealCancelId: string;
  } = {} as never;

  const PNG = Buffer.from(
    // 1x1 PNG（最小合法字节，仅用于管线测试）
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );

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

  /** 授权 → 直传 → finalize，返回 mediaId 列表 */
  async function uploadImages(agent: Agent, purpose: string, count: number): Promise<string[]> {
    const auth = await agent.post('/api/v1/media/upload-authorizations').send({ purpose, count }).expect(201);
    const uploads = auth.body.data as { mediaId: string; uploadPath: string }[];
    for (const item of uploads) {
      await request(app.getHttpServer())
        .put(item.uploadPath)
        .set('Content-Type', 'image/png')
        .send(PNG)
        .expect(200);
      await agent.post(`/api/v1/media/${item.mediaId}/finalize`).expect(201);
    }
    return uploads.map((u) => u.mediaId);
  }

  async function createListing(agent: Agent, overrides: Record<string, unknown> = {}) {
    const images = (overrides.images as string[] | undefined) ?? (await uploadImages(agent, 'LISTING_IMAGE', 1));
    const res = await agent
      .post('/api/v1/market/listings')
      .send({
        listingType: 'SALE',
        categoryCode: 'FEEDING',
        title: '九成新猫爬架转让',
        description: '买重了，只用过两次，同城自提',
        priceMinor: 12800,
        condition: 'LIKE_NEW',
        areaCode: '440305',
        handoverWindow: '周末下午',
        images,
        ...overrides,
        ...(overrides.images === undefined ? { images } : {}),
      })
      .expect(201);
    return res.body.data as { id: string; status: string };
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
      'TRUNCATE TABLE market_deals, market_listings, reactions, media_assets, conversations, care_orders, care_requests, care_offerings, reviews, sensitive_access_logs, idempotency_records, disputes, care_evidence CASCADE',
    );

    const s = await loginWechat('m3-seller');
    const b = await loginWechat('m3-buyer');
    const b2 = await loginWechat('m3-buyer-2');
    const st = await loginWechat('m3-stranger');
    seller.agent = s.agent; seller.id = s.id;
    buyer.agent = b.agent; buyer.id = b.id;
    buyer2.agent = b2.agent; buyer2.id = b2.id;
    stranger.agent = st.agent; stranger.id = st.id;
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE market_deals, market_listings, reactions, media_assets, conversations, reviews, sensitive_access_logs, idempotency_records, disputes, care_evidence CASCADE',
    );
    await fs.rm(process.env.MEDIA_DIR!, { recursive: true, force: true });
    await app.close();
  });

  describe('媒体管线（D-007 本地盘适配器）', () => {
    it('授权：purpose 非法 400；count 越界 400；正常授权返回短时直传地址', async () => {
      await seller.agent.post('/api/v1/media/upload-authorizations').send({ purpose: 'AVATAR_X', count: 1 }).expect(400);
      await seller.agent.post('/api/v1/media/upload-authorizations').send({ purpose: 'LISTING_IMAGE', count: 99 }).expect(400);
      const ok = await seller.agent
        .post('/api/v1/media/upload-authorizations')
        .send({ purpose: 'LISTING_IMAGE', count: 2 })
        .expect(201);
      expect(ok.body.data).toHaveLength(2);
      expect(ok.body.data[0].uploadPath).toContain('/api/v1/media/');
      expect(ok.body.data[0].uploadPath).toContain('token=');
      state.mediaIds = ok.body.data.map((u: { mediaId: string }) => u.mediaId);
    });

    it('直传：篡改 token 403；类型白名单外 400；正常上传→finalize→签名读取', async () => {
      const auth = await seller.agent
        .post('/api/v1/media/upload-authorizations')
        .send({ purpose: 'LISTING_IMAGE', count: 1 })
        .expect(201);
      const { mediaId, uploadPath } = auth.body.data[0];

      const bad = uploadPath.replace(/token=[^&]+/, 'token=forged');
      await request(app.getHttpServer()).put(bad).set('Content-Type', 'image/png').send(PNG).expect(403);

      await request(app.getHttpServer())
        .put(uploadPath)
        .set('Content-Type', 'application/pdf')
        .send(PNG)
        .expect(400);

      await request(app.getHttpServer()).put(uploadPath).set('Content-Type', 'image/png').send(PNG).expect(200);
      const finalized = await seller.agent.post(`/api/v1/media/${mediaId}/finalize`).expect(201);
      expect(finalized.body.data).toMatchObject({ moderationStatus: 'PENDING', mimeType: 'image/png' });

      // 未上传就 finalize → 409
      const auth2 = await seller.agent
        .post('/api/v1/media/upload-authorizations')
        .send({ purpose: 'LISTING_IMAGE', count: 1 })
        .expect(201);
      const notUploaded = await seller.agent.post(`/api/v1/media/${auth2.body.data[0].mediaId}/finalize`).expect(409);
      expect(notUploaded.body.error.code).toBe('RESOURCE_CONFLICT');

      // 读取：owner 可拿签名 URL 并取到字节
      const urlRes = await seller.agent.get(`/api/v1/media/${mediaId}/url`).expect(200);
      const file = await request(app.getHttpServer()).get(urlRes.body.data.path).expect(200);
      expect(file.headers['content-type']).toContain('image/png');
      expect(file.body.length).toBe(PNG.length);

      // 签名过期/伪造
      const expired = urlRes.body.data.path.replace(/expires=\d+/, 'expires=1');
      await request(app.getHttpServer()).get(expired).expect(403);
    });

    it('读取授权：他人未关联列表的图片 403；关联 PUBLISHED 列表后公开可读', async () => {
      const [img] = await uploadImages(seller.agent, 'LISTING_IMAGE', 1);
      await stranger.agent.get(`/api/v1/media/${img}/url`).expect(403);

      const listing = await createListing(seller.agent, { images: [img] });
      const res = await request(app.getHttpServer()).get(`/api/v1/media/${img}/url`).expect(200);
      expect(res.body.data.path).toContain('/file');
      expect(listing.status).toBe('PUBLISHED');
    });

    it('频控：一小时内授权次数超限 → 429 RATE_LIMITED（独立用户，避免影响其他用例配额）', async () => {
      const limiter = await loginWechat('m3-rate-limiter');
      for (let i = 0; i < 20; i += 1) {
        await limiter.agent.post('/api/v1/media/upload-authorizations').send({ purpose: 'POST_IMAGE', count: 1 }).expect(201);
      }
      const blocked = await limiter.agent
        .post('/api/v1/media/upload-authorizations')
        .send({ purpose: 'POST_IMAGE', count: 1 })
        .expect(429);
      expect(blocked.body.error.code).toBe('RATE_LIMITED');
    });
  });

  describe('列表：发布/检索/详情/收藏', () => {
    it('价格与类型一致性：SALE 无价 400；GIFT 带价 400；HIGH 风险类目转人审', async () => {
      const images = await uploadImages(seller.agent, 'LISTING_IMAGE', 1);
      const bad = await seller.agent
        .post('/api/v1/market/listings')
        .send({ listingType: 'SALE', categoryCode: 'FEEDING', title: '无价出售测试', description: 'x', areaCode: '440305', images })
        .expect(400);
      expect(bad.body.error.code).toBe('LISTING_PRICE_INVALID');

      const badGift = await seller.agent
        .post('/api/v1/market/listings')
        .send({ listingType: 'GIFT', categoryCode: 'FEEDING', title: '带价赠送测试', description: 'x', priceMinor: 100, areaCode: '440305', images })
        .expect(400);
      expect(badGift.body.error.code).toBe('LISTING_PRICE_INVALID');

      const highRisk = await createListing(seller.agent, {
        listingType: 'GIFT',
        categoryCode: 'PET_FOOD',
        title: '未开封猫粮赠送',
        priceMinor: undefined,
      });
      state.listingHighRiskId = highRisk.id;
      expect(highRisk.status).toBe('PENDING_REVIEW'); // 人工审核
    });

    it('图片归属校验：用他人 media 400；列表公开检索只出 PUBLISHED', async () => {
      const otherImages = await uploadImages(buyer.agent, 'LISTING_IMAGE', 1);
      await seller.agent
        .post('/api/v1/market/listings')
        .send({ listingType: 'SALE', categoryCode: 'FEEDING', title: '盗图测试列表', description: 'x', priceMinor: 100, areaCode: '440305', images: otherImages })
        .expect(400);

      const main = await createListing(seller.agent);
      state.listingId = main.id;

      const list = await request(app.getHttpServer()).get('/api/v1/market/listings?listingType=SALE').expect(200);
      const ids = list.body.data.map((l: { id: string }) => l.id);
      expect(ids).toContain(state.listingId);
      expect(ids).not.toContain(state.listingHighRiskId);
      const item = list.body.data.find((l: { id: string }) => l.id === state.listingId);
      expect(item.sellerTrust).toBeTruthy();
      expect(item.imageMediaIds.length).toBeGreaterThan(0);

      // 关键词检索
      const kw = await request(app.getHttpServer()).get('/api/v1/market/listings?keyword=猫爬架').expect(200);
      expect(kw.body.data.some((l: { id: string }) => l.id === state.listingId)).toBe(true);
    });

    it('详情可见性：人审中列表对他人 404、owner 可见；含安全提示', async () => {
      await stranger.agent.get(`/api/v1/market/listings/${state.listingHighRiskId}`).expect(404);
      const mine = await seller.agent.get(`/api/v1/market/listings/${state.listingHighRiskId}`).expect(200);
      expect(mine.body.data.isOwner).toBe(true);

      const detail = await request(app.getHttpServer()).get(`/api/v1/market/listings/${state.listingId}`).expect(200);
      expect(detail.body.data.safetyTips.length).toBeGreaterThan(0);
    });

    it('PATCH：非 owner 404；状态流转非法 400；正常改价 200', async () => {
      await buyer.agent.patch(`/api/v1/market/listings/${state.listingId}`).send({ title: '篡改标题五字' }).expect(404);

      // 专用列表验证状态机：PUBLISHED → EXPIRED 合法；EXPIRED → PUBLISHED 非法
      const tmp = await createListing(seller.agent, { title: '状态流转测试列表' });
      await seller.agent.patch(`/api/v1/market/listings/${tmp.id}`).send({ status: 'EXPIRED' }).expect(200);
      const invalid = await seller.agent.patch(`/api/v1/market/listings/${tmp.id}`).send({ status: 'PUBLISHED' }).expect(400);
      expect(invalid.body.error.code).toBe('REQUEST_VALIDATION_FAILED');

      const ok = await seller.agent.patch(`/api/v1/market/listings/${state.listingId}`).send({ priceMinor: 11800 }).expect(200);
      expect(ok.body.data.priceMinor).toBe(11800);
    });

    it('收藏：PUT/DELETE 幂等 + 计数', async () => {
      const first = await buyer.agent.put(`/api/v1/market/listings/${state.listingId}/favorite`).expect(200);
      expect(first.body.data).toMatchObject({ favorited: true, favoriteCount: 1 });
      const again = await buyer.agent.put(`/api/v1/market/listings/${state.listingId}/favorite`).expect(200);
      expect(again.body.data.favoriteCount).toBe(1); // 幂等不重复计数
      const listed = await buyer.agent.get(`/api/v1/market/listings/${state.listingId}`).expect(200);
      expect(listed.body.data.isFavorited).toBe(true);
      const removed = await buyer.agent.delete(`/api/v1/market/listings/${state.listingId}/favorite`).expect(200);
      expect(removed.body.data).toMatchObject({ favorited: false, favoriteCount: 0 });
      await buyer.agent.delete(`/api/v1/market/listings/${state.listingId}/favorite`).expect(200); // 再删幂等
    });
  });

  describe('交易：一物一单 + 状态机 + 纠纷 + 评价', () => {
    it('创建交易：自己交易 400；两个买家可同时咨询（CONTACTED）', async () => {
      await seller.agent.post('/api/v1/market/deals').send({ listingId: state.listingId }).expect(400);
      const d1 = await buyer.agent.post('/api/v1/market/deals').send({ listingId: state.listingId, message: '想要，周末能取' }).expect(201);
      state.dealId = d1.body.data.id;
      expect(d1.body.data.status).toBe('CONTACTED');
      expect(d1.body.data.conversationId).toBeTruthy();

      const dup = await buyer.agent.post('/api/v1/market/deals').send({ listingId: state.listingId }).expect(409);
      expect(dup.body.error.code).toBe('DEAL_ALREADY_IN_PROGRESS');

      const d2 = await buyer2.agent.post('/api/v1/market/deals').send({ listingId: state.listingId, message: '排个队' }).expect(201);
      state.deal2Id = d2.body.data.id;
    });

    it('非参与方读交易 404；参与方读详情 200 同构；会话含首条留言', async () => {
      await stranger.agent.get(`/api/v1/market/deals/${state.dealId}`).expect(404);
      const detail = await buyer.agent.get(`/api/v1/market/deals/${state.dealId}`).expect(200);
      expect(detail.body.data).toMatchObject({ id: state.dealId, status: 'CONTACTED', role: 'BUYER' });
      expect(detail.body.data.conversationId).toBeTruthy();
      expect(detail.body.data.listing.title).toBeTruthy();
      const sellerView = await seller.agent.get(`/api/v1/market/deals/${state.dealId}`).expect(200);
      expect(sellerView.body.data.role).toBe('SELLER');
      const messages = await prisma.message.findMany({ where: { conversation: { relatedDealId: state.dealId } } });
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toContain('周末能取');
    });

    it('约定：买家确认 → AGREEMENT_PENDING；另一买家此时被一物一单拒绝；卖家确认 → AGREED', async () => {
      const r1 = await buyer.agent
        .post(`/api/v1/market/deals/${state.dealId}/agree`)
        .send({ handoverArea: '科技园地铁站 A 口', note: '周日下午三点' })
        .expect(200);
      expect(r1.body.data.status).toBe('AGREEMENT_PENDING');

      const blocked = await buyer2.agent
        .post(`/api/v1/market/deals/${state.deal2Id}/agree`)
        .send({ handoverArea: '别处' })
        .expect(409);
      expect(blocked.body.error.code).toBe('DEAL_ALREADY_IN_PROGRESS');

      const r2 = await seller.agent.post(`/api/v1/market/deals/${state.dealId}/agree`).send({}).expect(200);
      expect(r2.body.data.status).toBe('AGREED');
      expect((r2.body.data.agreement as { handoverArea?: string }).handoverArea).toBe('科技园地铁站 A 口');

      // 重复确认幂等
      const again = await buyer.agent.post(`/api/v1/market/deals/${state.dealId}/agree`).send({}).expect(200);
      expect(again.body.data.status).toBe('AGREED');
    });

    it('交接：首方确认 → HANDED_OVER 且物品原子 SOLD、竞品交易自动终结；另一方确认 → COMPLETED', async () => {
      const first = await buyer.agent.post(`/api/v1/market/deals/${state.dealId}/complete`).expect(200);
      expect(first.body.data.status).toBe('HANDED_OVER');

      const listing = await prisma.marketListing.findUniqueOrThrow({ where: { id: state.listingId } });
      expect(listing.status).toBe('SOLD');
      const competing = await prisma.marketDeal.findUniqueOrThrow({ where: { id: state.deal2Id } });
      expect(competing.status).toBe('CANCELLED');
      expect(competing.cancelReasonCode).toBe('LISTING_SOLD');

      // 同方重复确认 → 等待对方
      const again = await buyer.agent.post(`/api/v1/market/deals/${state.dealId}/complete`).expect(409);
      expect(again.body.error.code).toBe('RESOURCE_CONFLICT');

      const done = await seller.agent.post(`/api/v1/market/deals/${state.dealId}/complete`).expect(200);
      expect(done.body.data.status).toBe('COMPLETED');
      expect(done.body.data.completedAt).toBeTruthy();

      // SOLD 后关键字段禁改
      const locked = await seller.agent.patch(`/api/v1/market/listings/${state.listingId}`).send({ priceMinor: 1 }).expect(403);
      expect(locked.body.error.code).toBe('RESOURCE_FORBIDDEN');
    });

    it('评价：仅 COMPLETED、每方一次、重复 409；非参与方 404', async () => {
      const r = await buyer.agent
        .post(`/api/v1/market/deals/${state.dealId}/reviews`)
        .set('Idempotency-Key', 'idem-deal-review-buyer')
        .send({ rating: 5, tags: ['沟通顺畅'], content: '物品如描述' })
        .expect(200);
      expect(r.body.data).toMatchObject({ role: 'BUYER', targetType: 'MARKET_DEAL' });

      const dup = await buyer.agent
        .post(`/api/v1/market/deals/${state.dealId}/reviews`)
        .set('Idempotency-Key', 'idem-deal-review-buyer-2')
        .send({ rating: 3 })
        .expect(409);
      expect(dup.body.error.code).toBe('REVIEW_ALREADY_EXISTS');

      await stranger.agent
        .post(`/api/v1/market/deals/${state.dealId}/reviews`)
        .set('Idempotency-Key', 'idem-deal-review-stranger')
        .send({ rating: 5 })
        .expect(404);
    });

    it('取消：已取消交易不可再约定/评价；取消记原因码', async () => {
      const listing2 = await createListing(seller.agent, { title: '取消流程测试列表' });
      const d = await buyer.agent.post('/api/v1/market/deals').send({ listingId: listing2.id }).expect(201);
      state.dealCancelId = d.body.data.id;

      const cancelled = await buyer.agent
        .post(`/api/v1/market/deals/${state.dealCancelId}/cancel`)
        .send({ reasonCode: 'BUYER_CHANGED_MIND', note: '临时不要了' })
        .expect(200);
      expect(cancelled.body.data.status).toBe('CANCELLED');
      expect(cancelled.body.data.cancelReasonCode).toBe('BUYER_CHANGED_MIND');

      await seller.agent.post(`/api/v1/market/deals/${state.dealCancelId}/agree`).send({}).expect(409);
      await buyer.agent.post(`/api/v1/market/deals/${state.dealCancelId}/cancel`).send({ reasonCode: 'OTHER' }).expect(409);
      // 取消后可重新对同一列表发起新交易（旧交易已终结）
      await buyer.agent.post('/api/v1/market/deals').send({ listingId: listing2.id }).expect(201);
    });

    it('纠纷：AGREED 后可发起 → DISPUTED + 工单；重复发起 409', async () => {
      const listing3 = await createListing(seller.agent, { title: '纠纷流程测试列表' });
      const d = await buyer.agent.post('/api/v1/market/deals').send({ listingId: listing3.id }).expect(201);
      const dealId = d.body.data.id;
      await buyer.agent.post(`/api/v1/market/deals/${dealId}/agree`).send({ handoverArea: '地铁站' }).expect(200);
      await seller.agent.post(`/api/v1/market/deals/${dealId}/agree`).send({}).expect(200);

      const dispute = await buyer.agent
        .post(`/api/v1/market/deals/${dealId}/disputes`)
        .send({ reasonCode: 'ITEM_NOT_AS_DESCRIBED', description: '实物与描述不符，外壳有裂痕' })
        .expect(200);
      expect(dispute.body.data).toMatchObject({ caseType: 'MARKET', status: 'OPEN' });

      const again = await seller.agent
        .post(`/api/v1/market/deals/${dealId}/disputes`)
        .send({ reasonCode: 'OTHER', description: '重复发起纠纷测试' })
        .expect(409);
      expect(again.body.error.code).toBe('DISPUTE_ALREADY_OPEN');

      // 纠纷中不可完成
      await buyer.agent.post(`/api/v1/market/deals/${dealId}/complete`).expect(409);
    });
  });
});
