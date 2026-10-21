-- AlterTable
ALTER TABLE "user_private_profiles" ADD COLUMN     "email_encrypted" TEXT,
ADD COLUMN     "email_masked" TEXT,
ADD COLUMN     "email_verified_at" TIMESTAMPTZ;
