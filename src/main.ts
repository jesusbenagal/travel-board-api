import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';

import { RequestIdInterceptor } from './config/interceptors/request-id.interceptor';
import { HttpExceptionFilter } from './config/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');
  app.enableVersioning({ type: VersioningType.URI });

  const config = app.get(ConfigService);
  const origins = (config.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.enableCors({
    origin: origins.length ? origins : '*',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalInterceptors(new RequestIdInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Travel Board API')
    .setDescription('API Base (v0): Auth, Users, Trips, Utilities')
    .setVersion(config.get<string>('API_VERSION') ?? '0.0.1')
    .addBearerAuth()
    // TODO: Add tags when other modules are created
    .addTag('Utilities')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('/docs', app, document);

  const port = config.get<number>('PORT') ?? 3000;

  await app.listen(port);
  console.log(`✅ API up at http://localhost:${port}/api/v1  | Docs: /docs`);
}
bootstrap();
