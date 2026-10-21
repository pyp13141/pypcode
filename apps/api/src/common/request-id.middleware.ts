import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

/**
 * 为每个请求分配 requestId（沿用上游 X-Request-Id 供链路排查），
 * 写入响应头并供信封/错误结构使用。
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.header('X-Request-Id');
    const requestId = incoming && /^[\w.-]{1,64}$/.test(incoming) ? incoming : randomUUID();
    (req as Request & { requestId?: string }).requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    next();
  }
}
