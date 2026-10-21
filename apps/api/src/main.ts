import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';

async function bootstrap() {
  // D-006 生产护栏：未配置微信凭证且未显式允许 Mock 时，生产启动即失败——绝不静默 Mock
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_WECHAT_MOCK !== 'true' && !process.env.WECHAT_APPID) {
    throw new Error('生产环境必须配置 WECHAT_APPID/WECHAT_APPSECRET，或显式设置 ALLOW_WECHAT_MOCK=true（仅限内测）');
  }

  const app = await NestFactory.create(AppModule);

  // 前缀 /api/v1（docs/API.md）；本机仅监听回环，对外由 Caddy 反代
  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('宠邻 API')
    .setDescription('宠邻（Pet Neighbor）互助平台 API — 契约见 docs/API.md')
    .setVersion(process.env.APP_VERSION ?? '0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/v1/docs', app, document);

  const host = process.env.API_HOST ?? '127.0.0.1';
  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port, host);
  // eslint-disable-next-line no-console
  console.log(`pet-neighbor api listening on http://${host}:${port}/api/v1`);
}

void bootstrap();
