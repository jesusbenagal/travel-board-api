import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { Server } from 'http';

import { buildTestApp } from '../utils/test-app';
import { resetTestDb } from '../utils/test-db';
import { seedTripWithShare } from '../utils/seed';

describe('Public Share - ETag (E2E)', () => {
  let app: INestApplication;
  let server: Server;
  let slug: string;

  beforeAll(async () => {
    resetTestDb();
    app = await buildTestApp();
    server = app.getHttpServer();

    const s = await seedTripWithShare(app);
    slug = s.slug;
  });

  afterAll(async () => app.close());

  it('second GET with If-None-Match returns 304', async () => {
    const first = await request(server)
      .get(`/api/v1/public/share/${slug}/trip`)
      .expect(200);

    const etag = first.headers.etag;
    expect(typeof etag).toBe('string');

    await request(server)
      .get(`/api/v1/public/share/${slug}/trip`)
      .set('If-None-Match', etag)
      .expect(304);
  });
});
