import request from 'supertest';
import { Server } from 'http';
import { INestApplication } from '@nestjs/common';

import { buildTestApp } from '../utils/test-app';
import { resetTestDb } from '../utils/test-db';

type AuthBundle = { token: string; userId: string; email: string };

async function registerLogin(
  server: Server,
  email: string,
): Promise<AuthBundle> {
  const password = 'Password123!';
  await request(server)
    .post('/api/v1/auth/register')
    .send({ email, password })
    .expect((res) => {
      if (![201, 409].includes(res.status))
        throw new Error(`register ${res.status}`);
    });
  const login = await request(server)
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);
  const token = String(login.body.accessToken);
  const me = await request(server)
    .get('/api/v1/users/me')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  return { token, userId: String(me.body.id), email };
}

async function createTrip(
  server: Server,
  token: string,
  title = 'Trip Votes',
): Promise<string> {
  const res = await request(server)
    .post('/api/v1/trips')
    .set('Authorization', `Bearer ${token}`)
    .send({
      title,
      startDate: '2025-06-01T00:00:00Z',
      endDate: '2025-06-07T00:00:00Z',
      timezone: 'Europe/Madrid',
    })
    .expect(201);
  return String(res.body.id);
}

async function createItem(
  server: Server,
  token: string,
  tripId: string,
): Promise<string> {
  const res = await request(server)
    .post(`/api/v1/trips/${tripId}/items`)
    .set('Authorization', `Bearer ${token}`)
    .send({ type: 'NOTE', title: 'Votable', timezone: 'Europe/Madrid' })
    .expect(201);
  return String(res.body.id);
}

async function inviteAndAccept(
  server: Server,
  tripId: string,
  inviterToken: string,
  invitee: AuthBundle,
  role: 'EDITOR' | 'VIEWER',
): Promise<void> {
  const inv = await request(server)
    .post(`/api/v1/trips/${tripId}/invites`)
    .set('Authorization', `Bearer ${inviterToken}`)
    .send({ email: invitee.email, role })
    .expect(201);
  await request(server)
    .post(`/api/v1/invites/${inv.body.id}/accept`)
    .set('Authorization', `Bearer ${invitee.token}`)
    .expect(200);
}

describe('v0.5 Votes (E2E)', () => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    resetTestDb();
    app = await buildTestApp();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Miembro puede votar y el contador sube; doble voto → 409', async () => {
    const owner = await registerLogin(server, 'votes_owner_1@test.com');
    const viewer = await registerLogin(server, 'votes_viewer_1@test.com');

    const tripId = await createTrip(server, owner.token, 'Trip Votes A');
    const itemId = await createItem(server, owner.token, tripId);
    await inviteAndAccept(server, tripId, owner.token, viewer, 'VIEWER');

    // Vota
    const v1 = await request(server)
      .post(`/api/v1/trips/${tripId}/items/${itemId}/votes`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .expect(201);

    expect(v1.body.itemId).toBe(itemId);
    expect(v1.body.votesCount).toBe(1);

    // Doble voto -> 409
    const dup = await request(server)
      .post(`/api/v1/trips/${tripId}/items/${itemId}/votes`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .expect(409);

    expect(dup.body.error.code).toBe('VOTE_CONFLICT');

    // El owner ve el item con votesCount=1
    const detail = await request(server)
      .get(`/api/v1/trips/${tripId}/items/${itemId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(detail.body.votesCount).toBe(1);
  });

  it('Quitar voto → 204; quitar dos veces → 404 VOTE_NOT_FOUND', async () => {
    const owner = await registerLogin(server, 'votes_owner_2@test.com');
    const editor = await registerLogin(server, 'votes_editor_2@test.com');

    const tripId = await createTrip(server, owner.token, 'Trip Votes B');
    const itemId = await createItem(server, owner.token, tripId);
    await inviteAndAccept(server, tripId, owner.token, editor, 'EDITOR');

    // Vota
    await request(server)
      .post(`/api/v1/trips/${tripId}/items/${itemId}/votes`)
      .set('Authorization', `Bearer ${editor.token}`)
      .expect(201);

    // Quita voto
    await request(server)
      .delete(`/api/v1/trips/${tripId}/items/${itemId}/votes`)
      .set('Authorization', `Bearer ${editor.token}`)
      .expect(204);

    // Quita de nuevo -> 404
    const res = await request(server)
      .delete(`/api/v1/trips/${tripId}/items/${itemId}/votes`)
      .set('Authorization', `Bearer ${editor.token}`)
      .expect(404);

    expect(res.body.error.code).toBe('VOTE_NOT_FOUND');
  });

  it('No miembro no puede votar (403 TRIP_FORBIDDEN)', async () => {
    const owner = await registerLogin(server, 'votes_owner_3@test.com');
    const outsider = await registerLogin(server, 'votes_outsider_3@test.com');

    const tripId = await createTrip(server, owner.token, 'Trip Votes C');
    const itemId = await createItem(server, owner.token, tripId);

    const res = await request(server)
      .post(`/api/v1/trips/${tripId}/items/${itemId}/votes`)
      .set('Authorization', `Bearer ${outsider.token}`)
      .expect(403);

    expect(res.body.error.code).toBe('TRIP_FORBIDDEN');
  });
});
