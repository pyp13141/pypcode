-- CreateTable
CREATE TABLE "posts" (
    "id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "post_type" TEXT NOT NULL DEFAULT 'NORMAL',
    "content" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
    "moderation_status" TEXT NOT NULL DEFAULT 'APPROVED',
    "hidden_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_media" (
    "post_id" UUID NOT NULL,
    "media_asset_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "post_media_pkey" PRIMARY KEY ("post_id","media_asset_id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "parent_id" UUID,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'VISIBLE',
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_hides" (
    "user_id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_hides_pkey" PRIMARY KEY ("user_id","post_id")
);

-- CreateTable
CREATE TABLE "follows" (
    "follower_user_id" UUID NOT NULL,
    "followed_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("follower_user_id","followed_user_id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "reporter_user_id" UUID NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "images" UUID[],
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "assigned_admin_id" UUID,
    "resolution_note" TEXT,
    "resolved_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL DEFAULT '{}',
    "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_actions" (
    "id" UUID NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "admin_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_roles" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "permissions_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" UUID NOT NULL,
    "admin_user_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "request_id" TEXT,
    "reason" TEXT,
    "detail_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badges" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rule_json" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_badges" (
    "user_id" UUID NOT NULL,
    "badge_id" UUID NOT NULL,
    "earned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata_json" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "user_badges_pkey" PRIMARY KEY ("user_id","badge_id")
);

-- CreateTable
CREATE TABLE "help_posts" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "city_id" UUID,
    "station_id" UUID,
    "deadline_at" TIMESTAMPTZ,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolved_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "help_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL,
    "value_json" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "posts_moderation_status_created_at_idx" ON "posts"("moderation_status", "created_at");

-- CreateIndex
CREATE INDEX "posts_author_user_id_created_at_idx" ON "posts"("author_user_id", "created_at");

-- CreateIndex
CREATE INDEX "comments_post_id_created_at_idx" ON "comments"("post_id", "created_at");

-- CreateIndex
CREATE INDEX "follows_followed_user_id_idx" ON "follows"("followed_user_id");

-- CreateIndex
CREATE INDEX "reports_status_created_at_idx" ON "reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "reports_reporter_user_id_created_at_idx" ON "reports"("reporter_user_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at");

-- CreateIndex
CREATE INDEX "moderation_actions_target_type_target_id_idx" ON "moderation_actions"("target_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_roles_code_key" ON "admin_roles"("code");

-- CreateIndex
CREATE INDEX "admin_audit_logs_admin_user_id_created_at_idx" ON "admin_audit_logs"("admin_user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "badges_code_key" ON "badges"("code");

-- CreateIndex
CREATE UNIQUE INDEX "help_posts_post_id_key" ON "help_posts"("post_id");

-- CreateIndex
CREATE INDEX "help_posts_status_category_created_at_idx" ON "help_posts"("status", "category", "created_at");

-- CreateIndex
CREATE INDEX "help_posts_author_user_id_status_idx" ON "help_posts"("author_user_id", "status");

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_hides" ADD CONSTRAINT "post_hides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_hides" ADD CONSTRAINT "post_hides_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_user_id_fkey" FOREIGN KEY ("follower_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_followed_user_id_fkey" FOREIGN KEY ("followed_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_assigned_admin_id_fkey" FOREIGN KEY ("assigned_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "admin_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_posts" ADD CONSTRAINT "help_posts_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_posts" ADD CONSTRAINT "help_posts_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- M4 业务不变量（docs/ERD.md §4/§6 + DECISIONS D-013）
-- ============================================================================

-- 帖子
ALTER TABLE "posts" ADD CONSTRAINT "posts_post_type_check" CHECK ("post_type" IN ('NORMAL','HELP'));
ALTER TABLE "posts" ADD CONSTRAINT "posts_visibility_check" CHECK ("visibility" IN ('PUBLIC','FOLLOWERS','PRIVATE'));
ALTER TABLE "posts" ADD CONSTRAINT "posts_moderation_status_check" CHECK ("moderation_status" IN ('PENDING','APPROVED','REJECTED'));

-- 评论
ALTER TABLE "comments" ADD CONSTRAINT "comments_status_check" CHECK ("status" IN ('VISIBLE','DELETED'));

-- 关注：禁自关注（ERD 不变量 2）
ALTER TABLE "follows" ADD CONSTRAINT "follows_not_self_check" CHECK ("follower_user_id" <> "followed_user_id");

-- 举报：目标类型与原因白名单（产品 7.4 九类）
ALTER TABLE "reports" ADD CONSTRAINT "reports_target_type_check"
  CHECK ("target_type" IN ('USER','POST','COMMENT','LISTING','OFFERING','REQUEST','DEAL','CONVERSATION','MESSAGE'));
ALTER TABLE "reports" ADD CONSTRAINT "reports_reason_check"
  CHECK ("reason" IN ('SCAM','HARASSMENT','MISINFO','DANGEROUS','ANIMAL_ABUSE','PROHIBITED','IP','AD','OTHER'));
ALTER TABLE "reports" ADD CONSTRAINT "reports_status_check"
  CHECK ("status" IN ('NEW','PROCESSING','RESOLVED','DISMISSED','APPEALING','CLOSED'));

-- 后台
ALTER TABLE "admin_roles" ADD CONSTRAINT "admin_roles_code_check"
  CHECK ("code" IN ('content_moderator','support_operator','catalog_operator','analyst','super_admin'));
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_status_check" CHECK ("status" IN ('ACTIVE','DISABLED'));

-- 求助帖
ALTER TABLE "help_posts" ADD CONSTRAINT "help_posts_category_check" CHECK ("category" IN ('PET_CARE','NEIGHBOR'));
ALTER TABLE "help_posts" ADD CONSTRAINT "help_posts_status_check" CHECK ("status" IN ('OPEN','RESOLVED','CLOSED','EXPIRED'));

-- 追加式：后台操作审计
CREATE TRIGGER "admin_audit_logs_append_only" BEFORE UPDATE OR DELETE ON "admin_audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "petn_deny_modify"();

-- ============================================================================
-- 种子：后台角色（11.6 五角色，最小权限原则）
-- ============================================================================
INSERT INTO "admin_roles" ("id","code","name","permissions_json") VALUES
  (gen_random_uuid(),'content_moderator','内容审核','{"moderation":true,"reports":true}'),
  (gen_random_uuid(),'support_operator','客服支持','{"disputes":true,"reports":true,"orders_read":true}'),
  (gen_random_uuid(),'catalog_operator','类目运营','{"categories":true,"badges":true}'),
  (gen_random_uuid(),'analyst','数据分析','{"metrics":true}'),
  (gen_random_uuid(),'super_admin','超级管理员','{"all":true}');

-- 种子：徽章（规则在服务端判定，rule_json 为阈值说明）
INSERT INTO "badges" ("id","code","name","rule_json") VALUES
  (gen_random_uuid(),'CARE_FIRST','初次互助','{"completedCareOrders":1}'),
  (gen_random_uuid(),'CARE_VETERAN','互助达人','{"completedCareOrders":5}'),
  (gen_random_uuid(),'COMMUNITY_FIRST','社区新声','{"postsPublished":1}'),
  (gen_random_uuid(),'REVIEW_FIRST','以诚相待','{"reviewsGiven":1}');
