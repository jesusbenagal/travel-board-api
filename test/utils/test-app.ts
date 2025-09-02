import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';

import { PrismaService } from '../../src/database/prisma.service';

import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { requestIdMiddleware } from '../../src/common/middleware/request-id.middleware';

export async function buildTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();

  app.use(requestIdMiddleware);
  app.setGlobalPrefix('api/v1');
  app.enableVersioning({ type: VersioningType.URI });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.init();

  const prisma = app.get(PrismaService);
  await prisma.$connect();

  return app;
}
