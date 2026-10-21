-- AlterTable
ALTER TABLE "media_assets" ADD COLUMN     "finalized_at" TIMESTAMPTZ,
ADD COLUMN     "upload_expires_at" TIMESTAMPTZ,
ALTER COLUMN "mime_type" DROP NOT NULL,
ALTER COLUMN "size_bytes" DROP NOT NULL;

-- CreateTable
CREATE TABLE "market_categories" (
    "id" UUID NOT NULL,
    "parent_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "risk_level" TEXT NOT NULL DEFAULT 'LOW',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "sort" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_listings" (
    "id" UUID NOT NULL,
    "seller_user_id" UUID NOT NULL,
    "listing_type" TEXT NOT NULL,
    "category_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price_minor" BIGINT,
    "condition" TEXT,
    "area_code" TEXT NOT NULL,
    "handover_window" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "removed_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "market_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_listing_media" (
    "listing_id" UUID NOT NULL,
    "media_asset_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "market_listing_media_pkey" PRIMARY KEY ("listing_id","media_asset_id")
);

-- CreateTable
CREATE TABLE "market_deals" (
    "id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "buyer_user_id" UUID NOT NULL,
    "seller_user_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONTACTED',
    "handover_at" TIMESTAMPTZ,
    "handover_area" TEXT,
    "agreement_json" JSONB,
    "completed_at" TIMESTAMPTZ,
    "cancelled_at" TIMESTAMPTZ,
    "cancel_reason_code" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "market_deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_deal_events" (
    "id" UUID NOT NULL,
    "market_deal_id" UUID NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "actor_role" TEXT NOT NULL,
    "reason_code" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_deal_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" UUID NOT NULL,
    "reaction_type" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "conversation_type" TEXT NOT NULL,
    "related_order_id" UUID,
    "related_deal_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_participants" (
    "conversation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("conversation_id","user_id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "sender_user_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "market_categories_code_key" ON "market_categories"("code");

-- CreateIndex
CREATE INDEX "market_listings_category_id_area_code_status_idx" ON "market_listings"("category_id", "area_code", "status");

-- CreateIndex
CREATE INDEX "market_listings_seller_user_id_status_idx" ON "market_listings"("seller_user_id", "status");

-- CreateIndex
CREATE INDEX "market_deals_listing_id_status_idx" ON "market_deals"("listing_id", "status");

-- CreateIndex
CREATE INDEX "market_deals_buyer_user_id_status_idx" ON "market_deals"("buyer_user_id", "status");

-- CreateIndex
CREATE INDEX "market_deals_seller_user_id_status_idx" ON "market_deals"("seller_user_id", "status");

-- CreateIndex
CREATE INDEX "market_deal_events_market_deal_id_created_at_idx" ON "market_deal_events"("market_deal_id", "created_at");

-- CreateIndex
CREATE INDEX "reactions_target_type_target_id_idx" ON "reactions"("target_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "reactions_user_id_target_type_target_id_reaction_type_key" ON "reactions"("user_id", "target_type", "target_id", "reaction_type");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_related_order_id_key" ON "conversations"("related_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_related_deal_id_key" ON "conversations"("related_deal_id");

-- CreateIndex
CREATE INDEX "conversations_related_order_id_idx" ON "conversations"("related_order_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "media_assets_owner_user_id_created_at_idx" ON "media_assets"("owner_user_id", "created_at");

-- AddForeignKey
ALTER TABLE "market_categories" ADD CONSTRAINT "market_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "market_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_listings" ADD CONSTRAINT "market_listings_seller_user_id_fkey" FOREIGN KEY ("seller_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_listings" ADD CONSTRAINT "market_listings_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "market_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_listing_media" ADD CONSTRAINT "market_listing_media_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "market_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_listing_media" ADD CONSTRAINT "market_listing_media_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_deals" ADD CONSTRAINT "market_deals_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "market_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_deals" ADD CONSTRAINT "market_deals_buyer_user_id_fkey" FOREIGN KEY ("buyer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_deals" ADD CONSTRAINT "market_deals_seller_user_id_fkey" FOREIGN KEY ("seller_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_deal_events" ADD CONSTRAINT "market_deal_events_market_deal_id_fkey" FOREIGN KEY ("market_deal_id") REFERENCES "market_deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_related_order_id_fkey" FOREIGN KEY ("related_order_id") REFERENCES "care_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_related_deal_id_fkey" FOREIGN KEY ("related_deal_id") REFERENCES "market_deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- M3 业务不变量（docs/ERD.md §3/§6 + DECISIONS D-012）
-- ============================================================================

-- 分类
ALTER TABLE "market_categories" ADD CONSTRAINT "market_categories_risk_level_check"
  CHECK ("risk_level" IN ('LOW','MEDIUM','HIGH'));
ALTER TABLE "market_categories" ADD CONSTRAINT "market_categories_status_check"
  CHECK ("status" IN ('ACTIVE','DISABLED'));

-- 列表公告：价格与交易类型组合一致（ERD §6.9）
ALTER TABLE "market_listings" ADD CONSTRAINT "market_listings_listing_type_check"
  CHECK ("listing_type" IN ('GIFT','SWAP','SALE','WANTED'));
ALTER TABLE "market_listings" ADD CONSTRAINT "market_listings_status_check"
  CHECK ("status" IN ('DRAFT','PUBLISHED','PENDING_REVIEW','SOLD','REMOVED','EXPIRED'));
ALTER TABLE "market_listings" ADD CONSTRAINT "market_listings_condition_check"
  CHECK ("condition" IS NULL OR "condition" IN ('NEW','LIKE_NEW','GOOD','FAIR'));
ALTER TABLE "market_listings" ADD CONSTRAINT "market_listings_price_check"
  CHECK (("price_minor" IS NULL OR "price_minor" >= 0)
     AND (("listing_type" = 'SALE' AND "price_minor" > 0)
       OR ("listing_type" <> 'SALE' AND ("price_minor" IS NULL OR "price_minor" = 0))));

-- 交易
ALTER TABLE "market_deals" ADD CONSTRAINT "market_deals_status_check"
  CHECK ("status" IN ('CONTACTED','AGREEMENT_PENDING','AGREED','HANDED_OVER','COMPLETED','CANCELLED','DISPUTED'));
ALTER TABLE "market_deals" ADD CONSTRAINT "market_deals_party_check"
  CHECK ("buyer_user_id" <> "seller_user_id");

-- 交易事件
ALTER TABLE "market_deal_events" ADD CONSTRAINT "market_deal_events_actor_role_check"
  CHECK ("actor_role" IN ('BUYER','SELLER','ADMIN','SYSTEM'));

-- 互动（LISTING 用于集市收藏，D-012）
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_target_type_check"
  CHECK ("target_type" IN ('POST','COMMENT','LISTING'));
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_reaction_type_check"
  CHECK ("reaction_type" IN ('LIKE','FAVORITE'));

-- 会话：恰一业务对象非空（ERD §6.5）
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_type_check"
  CHECK ("conversation_type" IN ('CARE_ORDER','MARKET_DEAL'));
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_exactly_one_target_check"
  CHECK ((("related_order_id" IS NOT NULL)::int + ("related_deal_id" IS NOT NULL)::int) = 1);
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_status_check"
  CHECK ("status" IN ('ACTIVE','CLOSED'));

-- 消息
ALTER TABLE "messages" ADD CONSTRAINT "messages_status_check"
  CHECK ("status" IN ('SENT','DELETED'));

-- 媒体资产：上传授权时 size/mime 未知（finalize 回填）；旧 CHECK 收紧为"非空则 >0"
ALTER TABLE "media_assets" DROP CONSTRAINT IF EXISTS "media_assets_size_check";
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_size_check"
  CHECK ("size_bytes" IS NULL OR "size_bytes" > 0);

-- 追加式：交易事件表
CREATE TRIGGER "market_deal_events_append_only" BEFORE UPDATE OR DELETE ON "market_deal_events"
  FOR EACH ROW EXECUTE FUNCTION "petn_deny_modify"();

-- ============================================================================
-- 分类种子（产品 6.4；宠物食品/药品独立类目 HIGH 必须人审）
-- ============================================================================
INSERT INTO "market_categories" ("id","code","name","risk_level","status","sort") VALUES
  (gen_random_uuid(),'FEEDING','喂养用品','LOW','ACTIVE',10),
  (gen_random_uuid(),'CLEANING','清洁用品','LOW','ACTIVE',20),
  (gen_random_uuid(),'TRAVEL','出行用品','LOW','ACTIVE',30),
  (gen_random_uuid(),'TOYS','玩具','LOW','ACTIVE',40),
  (gen_random_uuid(),'CAGES','笼舍/围栏','MEDIUM','ACTIVE',50),
  (gen_random_uuid(),'APPAREL','服饰','LOW','ACTIVE',60),
  (gen_random_uuid(),'BOOKS','书籍与课程','LOW','ACTIVE',70),
  (gen_random_uuid(),'OTHER','其他','MEDIUM','ACTIVE',80),
  (gen_random_uuid(),'PET_FOOD','宠物食品','HIGH','ACTIVE',90),
  (gen_random_uuid(),'PET_MEDICINE','宠物药品','HIGH','ACTIVE',100);
