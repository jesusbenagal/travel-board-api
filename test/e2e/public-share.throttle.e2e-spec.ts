import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { Server } from 'http';

import { buildTestApp } from '../utils/test-app';
import { resetTestDb } from '../utils/test-db';
import { seedTripWithShare } from '../utils/seed';

describe('Public Share - Throttle (E2E)', () => {
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

  it('>=1 request should be rate-limited within window', async () => {
    const reqs = Array.from({ length: 35 }, () =>
      request(server).get(`/api/v1/public/share/${slug}/trip`),
    );
    const res = await Promise.allSettled(reqs);
    const statuses = res
      .map((r) => (r.status === 'fulfilled' ? r.value.status : 0))
      .filter(Boolean);

    expect(statuses.includes(429)).toBe(true);
  });
});
