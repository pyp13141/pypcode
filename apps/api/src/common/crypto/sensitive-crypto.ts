import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * 敏感字段加密（D-008）：AES-256-GCM。
 * 密钥经 SENSITIVE_ENCRYPTION_KEY 注入（32 字节 base64）；格式 v1:<iv_b64>:<tag_b64>:<ct_b64>。
 */
const ALGO = 'aes-256-gcm';

function key(): Buffer {
  const raw = process.env.SENSITIVE_ENCRYPTION_KEY;
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SENSITIVE_ENCRYPTION_KEY 未配置（生产必填）');
    }
    // 开发环境确定性弱密钥，仅保证本地可跑；生产启动即失败由上面兜底
    return createHash('sha256').update('dev-only-key').digest();
  }
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) throw new Error('SENSITIVE_ENCRYPTION_KEY 必须是 32 字节 base64');
  return buf;
}

export function encryptSensitive(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key(), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

export function decryptSensitive(payload: string): string {
  const [v, ivB, tagB, ctB] = payload.split(':');
  if (v !== 'v1') throw new Error('未知密文格式');
  const decipher = createDecipheriv(ALGO, key(), Buffer.from(ivB!, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB!, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ctB!, 'base64')), decipher.final()]).toString('utf8');
}

/** 手机号掩码：138****5678（展示用，明文只在解密路径出现） */
export function maskPhone(phone: string): string {
  return phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
}

/** 邮箱掩码：ab***@example.com（展示用，明文只在解密路径出现） */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***';
  const head = local.slice(0, 2);
  return `${head}***@${domain}`;
}

/** 会话令牌：随机 32 字节 base64url；库存 sha256 哈希（ERD 不变量） */
export function generateToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * 短时签名令牌（媒体直传/读取 URL，D-007 本地盘适配器同形状）：
 * token = HMAC-SHA256(key, `${scope}:${id}:${action}:${expires}`)，key 复用敏感字段密钥（D-008）。
 * 与 Bearer 会话令牌无关：只授权单个对象在有效期内的一次操作。
 */
export function signScopedToken(scope: string, id: string, action: string, expiresAtMs: number): string {
  return createHmac('sha256', key())
    .update(`${scope}:${id}:${action}:${expiresAtMs}`)
    .digest('base64url');
}

export function verifyScopedToken(
  scope: string,
  id: string,
  action: string,
  expiresAtMs: number,
  token: string,
): boolean {
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) return false;
  const expected = signScopedToken(scope, id, action, expiresAtMs);
  const a = Buffer.from(expected);
  const b = Buffer.from(token ?? '');
  return a.length === b.length && timingSafeEqual(a, b);
}
