-- 集市纠纷的 dispute_events.actor_role 需要 BUYER/SELLER（M2 的 CHECK 只覆盖 care 场景）
ALTER TABLE "dispute_events" DROP CONSTRAINT "dispute_events_actor_role_check";
ALTER TABLE "dispute_events" ADD CONSTRAINT "dispute_events_actor_role_check"
  CHECK ("actor_role" IN ('REQUESTER','PROVIDER','BUYER','SELLER','ADMIN','SYSTEM'));
