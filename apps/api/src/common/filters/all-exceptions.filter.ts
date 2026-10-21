import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Request, Response } from 'express';
import { ERROR_CODES } from '../error-codes';

/**
 * 错误统一为 docs/API.md 10.1 的 error 结构；不向客户端泄漏堆栈/内部细节。
 * code 一律取自 error-codes.ts 单一源（docs/ERRORS.md 为同步文档）。
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const requestId: string = (req as Request & { requestId?: string }).requestId ?? randomUUID();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string = ERROR_CODES.INTERNAL_ERROR;
    let message = '服务器内部错误';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'object' && body !== null) {
        const b = body as Record<string, unknown>;
        code = typeof b.code === 'string' ? b.code : defaultCodeForStatus(status);
        message = typeof b.message === 'string' ? b.message : exception.message;
        if (Array.isArray(b.message)) {
          message = b.message.join('; ');
          code = ERROR_CODES.REQUEST_VALIDATION_FAILED;
        }
      } else {
        message = String(body);
        code = defaultCodeForStatus(status);
      }
    } else {
      this.logger.error('Unhandled exception', exception instanceof Error ? exception.stack : String(exception));
    }

    res.status(status).json({ data: null, meta: { requestId }, error: { code, message } });
  }
}

function defaultCodeForStatus(status: HttpStatus): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return ERROR_CODES.REQUEST_INVALID;
    case HttpStatus.UNAUTHORIZED:
      return ERROR_CODES.AUTH_REQUIRED;
    case HttpStatus.FORBIDDEN:
      return ERROR_CODES.RESOURCE_FORBIDDEN;
    case HttpStatus.NOT_FOUND:
      return ERROR_CODES.RESOURCE_NOT_FOUND;
    case HttpStatus.CONFLICT:
      return ERROR_CODES.RESOURCE_CONFLICT;
    case HttpStatus.TOO_MANY_REQUESTS:
      return ERROR_CODES.RATE_LIMITED;
    default:
      return ERROR_CODES.INTERNAL_ERROR;
  }
}
