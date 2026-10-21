import { HttpException, Injectable, Logger } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import { ERROR_CODES } from '../error-codes';

/**
 * 邮件发送（D-014）：SMTP 配置齐全 → 真实发送；否则 Mock（验证码打日志）。
 * 平台方只需提供一个发件邮箱的 SMTP 授权码（如 QQ 邮箱），所有注册用户均能收到验证码。
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter = createTransport({
    host: process.env.SMTP_HOST || undefined,
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });

  get isReal(): boolean {
    return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  }

  async sendVerificationCode(to: string, code: string): Promise<boolean> {
    if (!this.isReal) {
      // Mock 供应商：验证码打日志（EMAIL-MOCK）
      // eslint-disable-next-line no-console
      console.log(`[EMAIL-MOCK] to=${to} code=${code}（未配置 SMTP，验证码仅写日志；接入后走真实邮件）`);
      return false;
    }
    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject: `宠邻登录验证码：${code}`,
        text: `你的宠邻登录验证码是 ${code}，5 分钟内有效。若非本人操作请忽略本邮件。`,
        html: `<div style="font-family:sans-serif;padding:24px"><h2 style="color:#2e7d57">宠邻登录验证码</h2><p>你的验证码是：</p><p style="font-size:32px;font-weight:700;letter-spacing:6px;color:#1f5238">${code}</p><p style="color:#888">5 分钟内有效；若非本人操作请忽略本邮件。</p></div>`,
      });
    } catch (error) {
      // 真实 SMTP 的 RCPT 拒收（邮箱不存在/写错）此前未捕获直穿 500，用户看到裸「服务器内部错误」（UX-REVIEW P1）
      this.logger.error(`邮件发送失败 to=${to}: ${error instanceof Error ? error.message : String(error)}`);
      throw new HttpException(
        {
          code: ERROR_CODES.AUTH_EMAIL_SEND_FAILED,
          message: '验证码邮件发送失败，请核对邮箱地址是否正确，或稍后重试',
        },
        502,
      );
    }
    return true;
  }
}
