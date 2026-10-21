-- CreateTable
CREATE TABLE "care_offerings" (
    "id" UUID NOT NULL,
    "provider_user_id" UUID NOT NULL,
    "service_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "area_code" TEXT NOT NULL,
    "radius_km" DOUBLE PRECISION,
    "pricing_type" TEXT NOT NULL,
    "price_minor" BIGINT,
    "cancel_rule" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "removed_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "care_offerings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_offerings_availability" (
    "id" UUID NOT NULL,
    "offering_id" UUID NOT NULL,
    "start_at" TIMESTAMPTZ NOT NULL,
    "end_at" TIMESTAMPTZ NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "care_offerings_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_requests" (
    "id" UUID NOT NULL,
    "requester_user_id" UUID NOT NULL,
    "service_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "area_code" TEXT NOT NULL,
    "start_at" TIMESTAMPTZ NOT NULL,
    "end_at" TIMESTAMPTZ NOT NULL,
    "frequency" TEXT,
    "pet_ids" UUID[],
    "pricing_type" TEXT NOT NULL,
    "price_minor" BIGINT,
    "cancel_rule" TEXT NOT NULL,
    "emergency_contact_encrypted" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "matched_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "care_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_applications" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "offering_id" UUID,
    "applicant_user_id" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "proposed_price_minor" BIGINT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decided_at" TIMESTAMPTZ,
    "care_order_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "care_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_orders" (
    "id" UUID NOT NULL,
    "order_no" TEXT NOT NULL,
    "offering_id" UUID,
    "request_id" UUID,
    "application_id" UUID,
    "requester_user_id" UUID NOT NULL,
    "provider_user_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "pricing_type" TEXT NOT NULL,
    "price_minor" BIGINT,
    "agreed_terms_json" JSONB NOT NULL,
    "terms_version" TEXT NOT NULL DEFAULT 'v1',
    "confirmed_by_requester_at" TIMESTAMPTZ,
    "confirmed_by_provider_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "cancelled_at" TIMESTAMPTZ,
    "cancel_reason_code" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "care_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_order_events" (
    "id" UUID NOT NULL,
    "care_order_id" UUID NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "actor_role" TEXT NOT NULL,
    "reason_code" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "care_order_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_order_private_details" (
    "care_order_id" UUID NOT NULL,
    "address_encrypted" TEXT,
    "entry_instructions_encrypted" TEXT,
    "emergency_contact_encrypted" TEXT,
    "access_policy" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "care_order_private_details_pkey" PRIMARY KEY ("care_order_id")
);

-- CreateTable
CREATE TABLE "care_visits" (
    "id" UUID NOT NULL,
    "care_order_id" UUID NOT NULL,
    "seq" INTEGER NOT NULL,
    "scheduled_at" TIMESTAMPTZ NOT NULL,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "care_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_evidence" (
    "id" UUID NOT NULL,
    "care_visit_id" UUID NOT NULL,
    "media_asset_id" UUID,
    "evidence_type" TEXT NOT NULL,
    "note" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "care_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "object_key" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "moderation_status" TEXT NOT NULL DEFAULT 'PENDING',
    "moderation_note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensitive_access_logs" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" UUID NOT NULL,
    "field_group" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "request_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sensitive_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "response_status" INTEGER,
    "response_ref" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" UUID NOT NULL,
    "case_type" TEXT NOT NULL,
    "care_order_id" UUID,
    "market_deal_id" UUID,
    "opened_by" UUID NOT NULL,
    "reason_code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolution_code" TEXT,
    "resolved_by" UUID,
    "resolved_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute_events" (
    "id" UUID NOT NULL,
    "dispute_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "actor_role" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispute_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "reviewer_user_id" UUID NOT NULL,
    "reviewee_user_id" UUID NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "tags" TEXT[],
    "content" TEXT,
    "status" TEXT NOT NULL DEFAULT 'VISIBLE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "care_offerings_area_code_service_type_status_idx" ON "care_offerings"("area_code", "service_type", "status");

-- CreateIndex
CREATE INDEX "care_offerings_provider_user_id_status_idx" ON "care_offerings"("provider_user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "care_offerings_availability_offering_id_start_at_key" ON "care_offerings_availability"("offering_id", "start_at");

-- CreateIndex
CREATE INDEX "care_requests_status_area_code_service_type_idx" ON "care_requests"("status", "area_code", "service_type");

-- CreateIndex
CREATE INDEX "care_requests_requester_user_id_status_idx" ON "care_requests"("requester_user_id", "status");

-- CreateIndex
CREATE INDEX "care_applications_request_id_status_idx" ON "care_applications"("request_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "care_applications_request_id_applicant_user_id_key" ON "care_applications"("request_id", "applicant_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "care_orders_order_no_key" ON "care_orders"("order_no");

-- CreateIndex
CREATE INDEX "care_orders_requester_user_id_status_idx" ON "care_orders"("requester_user_id", "status");

-- CreateIndex
CREATE INDEX "care_orders_provider_user_id_status_idx" ON "care_orders"("provider_user_id", "status");

-- CreateIndex
CREATE INDEX "care_orders_request_id_idx" ON "care_orders"("request_id");

-- CreateIndex
CREATE INDEX "care_order_events_care_order_id_created_at_idx" ON "care_order_events"("care_order_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "care_visits_care_order_id_seq_key" ON "care_visits"("care_order_id", "seq");

-- CreateIndex
CREATE INDEX "care_evidence_care_visit_id_idx" ON "care_evidence"("care_visit_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_object_key_key" ON "media_assets"("object_key");

-- CreateIndex
CREATE INDEX "media_assets_owner_user_id_purpose_idx" ON "media_assets"("owner_user_id", "purpose");

-- CreateIndex
CREATE INDEX "sensitive_access_logs_resource_type_resource_id_idx" ON "sensitive_access_logs"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "sensitive_access_logs_actor_user_id_created_at_idx" ON "sensitive_access_logs"("actor_user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_user_id_idempotency_key_key" ON "idempotency_records"("user_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "disputes_care_order_id_idx" ON "disputes"("care_order_id");

-- CreateIndex
CREATE INDEX "disputes_status_idx" ON "disputes"("status");

-- CreateIndex
CREATE INDEX "dispute_events_dispute_id_created_at_idx" ON "dispute_events"("dispute_id", "created_at");

-- CreateIndex
CREATE INDEX "reviews_reviewee_user_id_status_idx" ON "reviews"("reviewee_user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_target_type_target_id_reviewer_user_id_key" ON "reviews"("target_type", "target_id", "reviewer_user_id");

-- AddForeignKey
ALTER TABLE "care_offerings" ADD CONSTRAINT "care_offerings_provider_user_id_fkey" FOREIGN KEY ("provider_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_offerings_availability" ADD CONSTRAINT "care_offerings_availability_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "care_offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_requests" ADD CONSTRAINT "care_requests_requester_user_id_fkey" FOREIGN KEY ("requester_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_applications" ADD CONSTRAINT "care_applications_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "care_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_applications" ADD CONSTRAINT "care_applications_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "care_offerings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_applications" ADD CONSTRAINT "care_applications_applicant_user_id_fkey" FOREIGN KEY ("applicant_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_orders" ADD CONSTRAINT "care_orders_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "care_offerings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_orders" ADD CONSTRAINT "care_orders_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "care_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_orders" ADD CONSTRAINT "care_orders_requester_user_id_fkey" FOREIGN KEY ("requester_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_orders" ADD CONSTRAINT "care_orders_provider_user_id_fkey" FOREIGN KEY ("provider_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_order_events" ADD CONSTRAINT "care_order_events_care_order_id_fkey" FOREIGN KEY ("care_order_id") REFERENCES "care_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_order_private_details" ADD CONSTRAINT "care_order_private_details_care_order_id_fkey" FOREIGN KEY ("care_order_id") REFERENCES "care_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_visits" ADD CONSTRAINT "care_visits_care_order_id_fkey" FOREIGN KEY ("care_order_id") REFERENCES "care_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_evidence" ADD CONSTRAINT "care_evidence_care_visit_id_fkey" FOREIGN KEY ("care_visit_id") REFERENCES "care_visits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_evidence" ADD CONSTRAINT "care_evidence_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_evidence" ADD CONSTRAINT "care_evidence_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensitive_access_logs" ADD CONSTRAINT "sensitive_access_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_care_order_id_fkey" FOREIGN KEY ("care_order_id") REFERENCES "care_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_opened_by_fkey" FOREIGN KEY ("opened_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_events" ADD CONSTRAINT "dispute_events_dispute_id_fkey" FOREIGN KEY ("dispute_id") REFERENCES "disputes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewee_user_id_fkey" FOREIGN KEY ("reviewee_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- M2 业务不变量（docs/ERD.md §2/§6）：枚举受约束 + 金额组合一致 + 争议恰一目标。
-- Prisma 不表达 CHECK，用原生 SQL；Prisma 迁移引擎忽略 CHECK，不产生漂移。
-- ============================================================================

-- 服务公告
ALTER TABLE "care_offerings" ADD CONSTRAINT "care_offerings_service_type_check"
  CHECK ("service_type" IN ('FEED','WALK','BOARD','OTHER'));
ALTER TABLE "care_offerings" ADD CONSTRAINT "care_offerings_pricing_type_check"
  CHECK ("pricing_type" IN ('FREE','FIXED','NEGOTIABLE','BARTER'));
ALTER TABLE "care_offerings" ADD CONSTRAINT "care_offerings_price_check"
  CHECK (("price_minor" IS NULL OR "price_minor" >= 0)
     AND ("pricing_type" <> 'FIXED' OR "price_minor" IS NOT NULL)
     AND ("pricing_type" <> 'FREE' OR "price_minor" IS NULL OR "price_minor" = 0));
ALTER TABLE "care_offerings" ADD CONSTRAINT "care_offerings_status_check"
  CHECK ("status" IN ('DRAFT','PUBLISHED','PAUSED','ARCHIVED','REMOVED'));
ALTER TABLE "care_offerings" ADD CONSTRAINT "care_offerings_radius_check"
  CHECK ("radius_km" IS NULL OR ("radius_km" > 0 AND "radius_km" <= 100));

-- 可用时段
ALTER TABLE "care_offerings_availability" ADD CONSTRAINT "care_availability_time_check"
  CHECK ("end_at" > "start_at");
ALTER TABLE "care_offerings_availability" ADD CONSTRAINT "care_availability_capacity_check"
  CHECK ("capacity" >= 1);
ALTER TABLE "care_offerings_availability" ADD CONSTRAINT "care_availability_status_check"
  CHECK ("status" IN ('OPEN','CLOSED'));

-- 求助需求
ALTER TABLE "care_requests" ADD CONSTRAINT "care_requests_service_type_check"
  CHECK ("service_type" IN ('FEED','WALK','BOARD','OTHER'));
ALTER TABLE "care_requests" ADD CONSTRAINT "care_requests_time_check"
  CHECK ("end_at" > "start_at");
ALTER TABLE "care_requests" ADD CONSTRAINT "care_requests_pricing_type_check"
  CHECK ("pricing_type" IN ('FREE','FIXED','NEGOTIABLE','BARTER'));
ALTER TABLE "care_requests" ADD CONSTRAINT "care_requests_price_check"
  CHECK (("price_minor" IS NULL OR "price_minor" >= 0)
     AND ("pricing_type" <> 'FIXED' OR "price_minor" IS NOT NULL));
ALTER TABLE "care_requests" ADD CONSTRAINT "care_requests_status_check"
  CHECK ("status" IN ('DRAFT','PUBLISHED','MATCHED','CANCELLED','EXPIRED'));
ALTER TABLE "care_requests" ADD CONSTRAINT "care_requests_pets_check"
  CHECK (cardinality("pet_ids") BETWEEN 1 AND 5);

-- 服务申请
ALTER TABLE "care_applications" ADD CONSTRAINT "care_applications_status_check"
  CHECK ("status" IN ('PENDING','ACCEPTED','REJECTED','WITHDRAWN','EXPIRED'));
ALTER TABLE "care_applications" ADD CONSTRAINT "care_applications_price_check"
  CHECK ("proposed_price_minor" IS NULL OR "proposed_price_minor" >= 0);

-- 服务订单
ALTER TABLE "care_orders" ADD CONSTRAINT "care_orders_status_check"
  CHECK ("status" IN ('PENDING_CONFIRMATION','CONFIRMED','IN_PROGRESS','COMPLETION_SUBMITTED','COMPLETED','CANCEL_REQUESTED','CANCELLED','DISPUTED'));
ALTER TABLE "care_orders" ADD CONSTRAINT "care_orders_party_check"
  CHECK ("provider_user_id" <> "requester_user_id");
ALTER TABLE "care_orders" ADD CONSTRAINT "care_orders_price_check"
  CHECK (("price_minor" IS NULL OR "price_minor" >= 0)
     AND ("pricing_type" <> 'FIXED' OR "price_minor" IS NOT NULL));

-- 订单状态历史
ALTER TABLE "care_order_events" ADD CONSTRAINT "care_order_events_actor_role_check"
  CHECK ("actor_role" IN ('REQUESTER','PROVIDER','ADMIN'));

-- 单次上门
ALTER TABLE "care_visits" ADD CONSTRAINT "care_visits_status_check"
  CHECK ("status" IN ('SCHEDULED','IN_PROGRESS','COMPLETION_SUBMITTED','COMPLETED','MISSED','CANCELLED','EXCEPTION'));
ALTER TABLE "care_visits" ADD CONSTRAINT "care_visits_seq_check" CHECK ("seq" >= 1);

-- 履约凭证：PHOTO 必带媒体资产；NOTE 必带文本
ALTER TABLE "care_evidence" ADD CONSTRAINT "care_evidence_type_check"
  CHECK ("evidence_type" IN ('PHOTO','NOTE'));
ALTER TABLE "care_evidence" ADD CONSTRAINT "care_evidence_payload_check"
  CHECK (("evidence_type" = 'PHOTO' AND "media_asset_id" IS NOT NULL)
      OR ("evidence_type" = 'NOTE' AND "note" IS NOT NULL));

-- 媒体资产
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_purpose_check"
  CHECK ("purpose" IN ('PET_AVATAR','POST_IMAGE','LISTING_IMAGE','EVIDENCE'));
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_moderation_status_check"
  CHECK ("moderation_status" IN ('PENDING','APPROVED','REJECTED'));
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_size_check" CHECK ("size_bytes" > 0);

-- 敏感访问审计
ALTER TABLE "sensitive_access_logs" ADD CONSTRAINT "sensitive_access_logs_resource_type_check"
  CHECK ("resource_type" IN ('CARE_ORDER','MEDIA','PROFILE'));
ALTER TABLE "sensitive_access_logs" ADD CONSTRAINT "sensitive_access_logs_field_group_check"
  CHECK ("field_group" IN ('ADDRESS','PHONE','EVIDENCE','EMERGENCY_CONTACT'));

-- 幂等记录
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_expires_check"
  CHECK ("expires_at" > "created_at");

-- 纠纷工单：恰一目标非空（ERD §6.5）
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_case_type_check"
  CHECK ("case_type" IN ('CARE','MARKET'));
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_exactly_one_target_check"
  CHECK ((("care_order_id" IS NOT NULL)::int + ("market_deal_id" IS NOT NULL)::int) = 1);
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_status_check"
  CHECK ("status" IN ('OPEN','EVIDENCE','PENDING_RULING','RULED','APPEALING','CLOSED'));

-- 纠纷事件
ALTER TABLE "dispute_events" ADD CONSTRAINT "dispute_events_actor_role_check"
  CHECK ("actor_role" IN ('REQUESTER','PROVIDER','ADMIN','SYSTEM'));
ALTER TABLE "dispute_events" ADD CONSTRAINT "dispute_events_event_type_check"
  CHECK ("event_type" IN ('EVIDENCE_ADD','COMMENT','RULING','APPEAL','SYSTEM'));

-- 评价
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_target_type_check"
  CHECK ("target_type" IN ('CARE_ORDER','MARKET_DEAL'));
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_role_check"
  CHECK ("role" IN ('REQUESTER','PROVIDER','BUYER','SELLER'));
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_status_check"
  CHECK ("status" IN ('VISIBLE','HIDDEN','DISPUTED_HIDDEN','DELETED'));
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_not_self_check"
  CHECK ("reviewer_user_id" <> "reviewee_user_id");

-- ============================================================================
-- 追加式历史表（ERD §6.7）：事件表只允许 INSERT，UPDATE/DELETE 由触发器拒绝。
-- ============================================================================
CREATE OR REPLACE FUNCTION "petn_deny_modify"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'append-only table %, % is not allowed', TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "care_order_events_append_only" BEFORE UPDATE OR DELETE ON "care_order_events"
  FOR EACH ROW EXECUTE FUNCTION "petn_deny_modify"();
CREATE TRIGGER "dispute_events_append_only" BEFORE UPDATE OR DELETE ON "dispute_events"
  FOR EACH ROW EXECUTE FUNCTION "petn_deny_modify"();
