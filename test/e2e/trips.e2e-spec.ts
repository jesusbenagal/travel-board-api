import request from 'supertest';
import { Server } from 'http';
import { INestApplication } from '@nestjs/common';
import { config as loadEnv } from 'dotenv';

import { buildTestApp } from '../utils/test-app';
import { resetTestDb } from '../utils/test-db';

async function loginAs(server: Server, email: string): Promise<string> {
  const password = 'Password123!';
  await request(server).post('/api/v1/auth/register').send({ email, password });
  const login = await request(server)
    .post('/api/v1/auth/login')
    .send({ email, password });
  return login.body.accessToken as string;
}

describe('Trips E2E', () => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    loadEnv({ path: '.env.test' });
    resetTestDb();
    app = await buildTestApp();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it('CRUD Owner: create → list → detail → update → delete', async () => {
    const token = await loginAs(server, 'owner@test.com');

    // create
    const create = await request(server)
      .post('/api/v1/trips')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Roma',
        description: 'Navidad',
        startDate: '2025-12-20T00:00:00Z',
        endDate: '2025-12-27T00:00:00Z',
        timezone: 'Europe/Madrid',
      })
      .expect(201);

    const tripId = create.body.id as string;

    // list
    const list = await request(server)
      .get('/api/v1/trips?page=1&pageSize=10')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(list.body.data.length).toBeGreaterThanOrEqual(1);
    expect(list.body.pagination.total).toBeGreaterThanOrEqual(1);

    // detail
    await request(server)
      .get(`/api/v1/trips/${tripId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // update
    const upd = await request(server)
      .patch(`/api/v1/trips/${tripId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Roma 2025' })
      .expect(200);
    expect(upd.body.title).toBe('Roma 2025');

    // delete
    await request(server)
      .delete(`/api/v1/trips/${tripId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    // after delete -> not found
    const detailAfter = await request(server)
      .get(`/api/v1/trips/${tripId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
    expect(detailAfter.body.error.code).toBe('TRIP_NOT_FOUND');
  });

  it('Validación de fechas (start > end) → 400 VALIDATION_ERROR', async () => {
    const token = await loginAs(server, 'fechas@test.com');

    const res = await request(server)
      .post('/api/v1/trips')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Malas Fechas',
        startDate: '2025-12-30T00:00:00Z',
        endDate: '2025-12-20T00:00:00Z',
        timezone: 'Europe/Madrid',
      })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('Acceso a trip de otro owner → 403 TRIP_FORBIDDEN', async () => {
    const token1 = await loginAs(server, 'owner1@test.com');
    const token2 = await loginAs(server, 'owner2@test.com');

    const create = await request(server)
      .post('/api/v1/trips')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        title: 'Trip Owner1',
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-01-05T00:00:00Z',
        timezone: 'Europe/Madrid',
      })
      .expect(201);
    const tripId = create.body.id as string;

    const res = await request(server)
      .get(`/api/v1/trips/${tripId}`)
      .set('Authorization', `Bearer ${token2}`)
      .expect(403);

    expect(res.body.error.code).toBe('TRIP_FORBIDDEN');
  });

  it('404 de ruta → NOT_FOUND con requestId', async () => {
    const res = await request(server).get('/api/v1/no-existe').expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(typeof res.headers['x-request-id']).toBe('string');
  });
});
