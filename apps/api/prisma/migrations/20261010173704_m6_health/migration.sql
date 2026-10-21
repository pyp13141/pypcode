-- CreateTable
CREATE TABLE "pet_health_logs" (
    "id" UUID NOT NULL,
    "pet_id" UUID NOT NULL,
    "log_type" TEXT NOT NULL,
    "value_num" DOUBLE PRECISION,
    "unit" TEXT,
    "recorded_at" TIMESTAMPTZ NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pet_health_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pet_mood_logs" (
    "id" UUID NOT NULL,
    "pet_id" UUID NOT NULL,
    "mood_tags" TEXT[],
    "severity" INTEGER,
    "observed_at" TIMESTAMPTZ NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pet_mood_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pet_health_logs_pet_id_log_type_recorded_at_idx" ON "pet_health_logs"("pet_id", "log_type", "recorded_at");

-- CreateIndex
CREATE INDEX "pet_mood_logs_pet_id_observed_at_idx" ON "pet_mood_logs"("pet_id", "observed_at");

-- AddForeignKey
ALTER TABLE "pet_health_logs" ADD CONSTRAINT "pet_health_logs_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pet_mood_logs" ADD CONSTRAINT "pet_mood_logs_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- M6 不变量（ERD §5）
ALTER TABLE "pet_health_logs" ADD CONSTRAINT "pet_health_logs_type_check"
  CHECK ("log_type" IN ('WEIGHT','DIET','WATER','ACTIVITY','EVENT'));
ALTER TABLE "pet_health_logs" ADD CONSTRAINT "pet_health_logs_source_check"
  CHECK ("source" IN ('MANUAL','DEVICE','VET'));
ALTER TABLE "pet_health_logs" ADD CONSTRAINT "pet_health_logs_value_check"
  CHECK ("value_num" IS NULL OR "value_num" > 0);
ALTER TABLE "pet_mood_logs" ADD CONSTRAINT "pet_mood_logs_severity_check"
  CHECK ("severity" IS NULL OR ("severity" BETWEEN 1 AND 5));
ALTER TABLE "pet_mood_logs" ADD CONSTRAINT "pet_mood_logs_tags_check"
  CHECK (cardinality("mood_tags") BETWEEN 1 AND 5);
