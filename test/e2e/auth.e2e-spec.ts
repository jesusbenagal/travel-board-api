import request from 'supertest';
import { Server } from 'http';
import { INestApplication } from '@nestjs/common';
import { config } from 'dotenv';

import { buildTestApp } from '../utils/test-app';
import { resetTestDb } from '../utils/test-db';

describe('Auth E2E', () => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    config({ path: '.env.test' });
    resetTestDb();
    app = await buildTestApp();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  const base = '/api/v1/auth';

  it('register  -> login -> refresh (happy path)', async () => {
    const email = 'jesus@test.com';
    const password = 'Password123!';

    const reg = await request(server)
      .post(`${base}/register`)
      .send({ email, password, name: 'Jesús' })
      .expect(201);
    expect(reg.body.user.email).toBe(email);
    expect(typeof reg.body.accessToken).toBe('string');
    expect(typeof reg.body.refreshToken).toBe('string');

    const login = await request(server)
      .post(`${base}/login`)
      .send({ email, password })
      .expect(200);
    expect(login.body.user.email).toBe(email);

    const refresh = await request(server)
      .post(`${base}/refresh`)
      .send({ refreshToken: login.body.refreshToken as string })
      .expect(200);
    expect(typeof refresh.body.accessToken).toBe('string');
    expect(typeof refresh.body.refreshToken).toBe('string');
  });

  it('login con credenciales inválidas → 401 AUTH_INVALID_CREDENTIALS', async () => {
    const res = await request(server)
      .post(`${base}/login`)
      .send({ email: 'no@existe.com', password: 'x' })
      .expect(401);

    expect(res.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
  });
});
