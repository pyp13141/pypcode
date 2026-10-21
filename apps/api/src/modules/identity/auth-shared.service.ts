import { BadRequestException, ForbiddenException, HttpException, Injectable, UnauthorizedException } from '@nestjs/common';
import { MailerService } from '../../common/mailer/mailer.service';
import { ERROR_CODES } from '../../common/error-codes';
import { generateToken, hashToken } from '../../common/crypto/sensitive-crypto';
import { PrismaService } from '../../prisma/prisma.service';

const ACCESS_TTL_MS = 2 * 60 * 60 * 1000; // 2h
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30d

export interface SessionTokens {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

/**
 * 会话核心：登录创建、刷新轮换（含盗用检测）、登出撤销。
 * 令牌只存哈希（ERD 不变量）；所有身份模块端点共用。
 */
@Injectable()
export class AuthSharedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
  ) {}

  async createSession(userId: string): Promise<SessionTokens> {
    const access = generateToken();
    const refresh = generateToken();
    const now = Date.now();
    await this.prisma.userSession.create({
      data: {
        userId,
        accessTokenHash: access.hash,
        refreshTokenHash: refresh.hash,
        accessExpiresAt: new Date(now + ACCESS_TTL_MS),
        refreshExpiresAt: new Date(now + REFRESH_TTL_MS),
      },
    });
    return {
      accessToken: access.token,
      accessTokenExpiresAt: new Date(now + ACCESS_TTL_MS).toISOString(),
      refreshToken: refresh.token,
      refreshTokenExpiresAt: new Date(now + REFRESH_TTL_MS).toISOString(),
    };
  }

  /** 按 provider+subject 查找或创建用户，返回 userId */
  async findOrCreateByIdentity(provider: string, providerSubject: string): Promise<{ userId: string; isNew: boolean }> {
    const identity = await this.prisma.userIdentity.findUnique({
      where: { provider_providerSubject: { provider, providerSubject } },
      include: { user: { select: { status: true } } },
    });
    if (identity) {
      // 封禁用户不得再建立会话（API §1.1：USER_BANNED）
      if (identity.user.status === 'BANNED') {
        throw new ForbiddenException({ code: ERROR_CODES.USER_BANNED, message: '账号已被封禁' });
      }
      return { userId: identity.userId, isNew: false };
    }

    const user = await this.prisma.user.create({
      data: {
        nickname: `宠邻用户${providerSubject.replace(/[^0-9a-zA-Z]/g, '').slice(-4) || '0000'}`,
        identities: { create: { provider, providerSubject } },
        privateProfile: { create: {} },
      },
    });
    return { userId: user.id, isNew: true };
  }

  /**
   * 刷新令牌轮换：旧 refresh 撤销、发新令牌对。
   * 盗用检测：已撤销的 refresh 再次出现 → 撤销该用户全部会话（可能令牌泄漏）。
   */
  async refresh(rawRefreshToken: string): Promise<SessionTokens> {
    const hash = hashToken(rawRefreshToken);
    const session = await this.prisma.userSession.findUnique({ where: { refreshTokenHash: hash } });

    if (!session) throw new UnauthorizedException({ code: ERROR_CODES.AUTH_REFRESH_INVALID, message: '刷新令牌无效' });

    if (session.revokedAt !== null) {
      await this.prisma.userSession.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException({ code: ERROR_CODES.AUTH_REFRESH_INVALID, message: '检测到令牌复用，全部会话已撤销，请重新登录' });
    }
    if (session.refreshExpiresAt < new Date()) {
      throw new UnauthorizedException({ code: ERROR_CODES.AUTH_REFRESH_EXPIRED, message: '刷新令牌已过期' });
    }

    // 轮换：撤销旧会话，建新会话
    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    return this.createSession(session.userId);
  }

  async logoutByAccessToken(rawAccessToken: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { accessTokenHash: hashToken(rawAccessToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** 邮箱规范化（D-014：身份主体用规范化邮箱，密文另存私密资料） */
  static normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  /**
   * 邮箱验证码（D-014：首期替代手机号）：内存存储（单实例 MVP，与短信同策略）；
   * 邮件供应商 Mock（验证码打日志，含 EMAIL-MOCK 标注）；限流 1 次/分钟/邮箱，5 分钟有效，5 次尝试。
   */
  async sendEmailCode(emailRaw: string): Promise<{ expiresInMinutes: number }> {
    const email = AuthSharedService.normalizeEmail(emailRaw);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: '邮箱格式不正确' });
    }
    const last = this.lastSentAt.get(`email:${email}`) ?? 0;
    if (Date.now() - last < 60_000) {
      // 契约：AUTH_RATE_LIMITED = 429（修复历史实现误用 401）
      throw new HttpException({ code: ERROR_CODES.AUTH_RATE_LIMITED, message: '发送过于频繁，请 1 分钟后再试' }, 429);
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    this.codeStore.set(`email:${email}`, { code, expiresAt: Date.now() + 5 * 60_000, attempts: 0 });
    this.lastSentAt.set(`email:${email}`, Date.now());
    // SMTP 已配置 → 真实发送（不返回 devCode，验证码只经邮件送达）
    const sent = await this.mailer.sendVerificationCode(email, code);
    if (sent) {
      return { expiresInMinutes: 5 };
    }
    // Mock 阶段：内测自助登录（AUTH_CODE_ECHO=true，仅本服务器开启）验证码直显；
    // 接入真实邮件供应商后 AUTH_CODE_ECHO 必须关闭
    return { expiresInMinutes: 5, ...(process.env.AUTH_CODE_ECHO === 'true' ? { devCode: code } : {}) };
  }

  verifyEmailCode(emailRaw: string, code: string): void {
    const email = AuthSharedService.normalizeEmail(emailRaw);
    this.verifyCode(`email:${email}`, code);
  }

  /** 仅供测试/运维排查（Mock 供应商阶段读取内存中的验证码；生产接入真实供应商后本方法应移除） */
  peekMockCode(subject: string): string | undefined {
    return this.codeStore.get(subject)?.code ?? this.codeStore.get(`email:${subject}`)?.code;
  }

  /** H5 短信码：内存存储（单实例 MVP；多实例时换 Redis，见 ARCHITECTURE 依赖策略） */
  private readonly codeStore = new Map<string, { code: string; expiresAt: number; attempts: number }>();

  async sendSmsCode(phone: string): Promise<{ expiresInMinutes: number }> {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      throw new BadRequestException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: '手机号格式不正确' });
    }
    const last = this.lastSentAt.get(phone) ?? 0;
    if (Date.now() - last < 60_000) {
      // 契约：AUTH_RATE_LIMITED = 429（修复历史实现误用 401）
      throw new HttpException({ code: ERROR_CODES.AUTH_RATE_LIMITED, message: '发送过于频繁，请 1 分钟后再试' }, 429);
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    this.codeStore.set(phone, { code, expiresAt: Date.now() + 5 * 60_000, attempts: 0 });
    this.lastSentAt.set(phone, Date.now());
    // 短信供应商 Mock：真实供应商接入见 D-006 附注；生产未配置供应商时同样走此分支并在日志标注
    // eslint-disable-next-line no-console
    console.log(`[SMS-MOCK] phone=${phone} code=${code}（生产环境将接入真实短信供应商）`);
    return { expiresInMinutes: 5 };
  }

  private readonly lastSentAt = new Map<string, number>();

  verifySmsCode(phone: string, code: string): void {
    this.verifyCode(phone, code);
  }

  /** 验证码通用校验：过期 / 尝试超次（5）/ 不匹配 → AUTH_CODE_INVALID；成功后一次性删除 */
  private verifyCode(subject: string, code: string): void {
    const entry = this.codeStore.get(subject);
    if (!entry || entry.expiresAt < Date.now()) {
      throw new BadRequestException({ code: ERROR_CODES.AUTH_CODE_INVALID, message: '验证码已失效，请重新获取' });
    }
    entry.attempts += 1;
    if (entry.attempts > 5) {
      this.codeStore.delete(subject);
      throw new BadRequestException({ code: ERROR_CODES.AUTH_CODE_INVALID, message: '尝试次数过多，请重新获取' });
    }
    if (entry.code !== code) {
      throw new BadRequestException({ code: ERROR_CODES.AUTH_CODE_INVALID, message: '验证码错误' });
    }
    this.codeStore.delete(subject); // 一次性
  }
}
