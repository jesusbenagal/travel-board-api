import request from 'supertest';
import { Server } from 'http';
import { INestApplication } from '@nestjs/common';
import { config as loadEnv } from 'dotenv';

import { buildTestApp } from '../utils/test-app';
import { resetTestDb } from '../utils/test-db';

async function authFlow(server: Server) {
  const email = 'user@test.com';
  const password = 'Password123!';
  await request(server).post('/api/v1/auth/register').send({ email, password });
  const login = await request(server)
    .post('/api/v1/auth/login')
    .send({ email, password });
  return { token: login.body.accessToken as string };
}

describe('Users E2E', () => {
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

  it('GET /users/me devuelve perfil', async () => {
    const { token } = await authFlow(server);
    const res = await request(server)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.email).toBe('user@test.com');
    expect(res.body).toHaveProperty('createdAt');
  });

  it('PATCH /users/me actualiza nombre', async () => {
    const { token } = await authFlow(server);
    const res = await request(server)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Nuevo Nombre' })
      .expect(200);

    expect(res.body.name).toBe('Nuevo Nombre');
  });

  it('GET /users/me sin token → 401', async () => {
    const res = await request(server).get('/api/v1/users/me').expect(401);
    expect(res.body.error.code).toBe('AUTH_FORBIDDEN');
  });
});
