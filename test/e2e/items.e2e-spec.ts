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
  // register (idempotente en DB reseteada)
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
  title = 'Trip Items',
): Promise<string> {
  const body = {
    title,
    description: 'items',
    startDate: '2025-06-01T00:00:00Z',
    endDate: '2025-06-07T00:00:00Z',
    timezone: 'Europe/Madrid',
  };
  const res = await request(server)
    .post('/api/v1/trips')
    .set('Authorization', `Bearer ${token}`)
    .send(body)
    .expect(201);
  return String(res.body.id);
}

async function inviteAndAccept(
  server: Server,
  tripId: string,
  inviterToken: string,
  invitee: AuthBundle,
  role: 'EDITOR' | 'VIEWER',
): Promise<string> {
  const inv = await request(server)
    .post(`/api/v1/trips/${tripId}/invites`)
    .set('Authorization', `Bearer ${inviterToken}`)
    .send({ email: invitee.email, role })
    .expect(201);
  await request(server)
    .post(`/api/v1/invites/${inv.body.id}/accept`)
    .set('Authorization', `Bearer ${invitee.token}`)
    .expect(200);
  return String(inv.body.id);
}

async function findMemberUserIdByEmail(
  server: Server,
  tripId: string,
  ownerToken: string,
  email: string,
): Promise<string> {
  const members = await request(server)
    .get(`/api/v1/trips/${tripId}/members`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .expect(200);
  const entry = (
    members.body.members as Array<{ email: string; userId: string }>
  ).find((m) => m.email === email);
  if (!entry) throw new Error('member not found');
  return entry.userId;
}

describe('v0.5 Items (E2E)', () => {
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

  it('OWNER crea item válido → detalle y list muestran votesCount=0', async () => {
    const owner = await registerLogin(server, 'items_owner_1@test.com');
    const tripId = await createTrip(server, owner.token, 'Trip Items A');

    const create = await request(server)
      .post(`/api/v1/trips/${tripId}/items`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        type: 'PLACE',
        title: 'Coliseo',
        notes: 'Entradas online',
        startAt: '2025-06-02T09:00:00Z',
        endAt: '2025-06-02T12:00:00Z',
        timezone: 'Europe/Rome',
        locationName: 'Colosseo',
        lat: 41.8902,
        lng: 12.4922,
        url: 'https://parcocolosseo.it/',
        order: 1,
      })
      .expect(201);

    expect(create.body.title).toBe('Coliseo');
    expect(create.body.votesCount).toBe(0);

    const detail = await request(server)
      .get(`/api/v1/trips/${tripId}/items/${create.body.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(detail.body.id).toBe(create.body.id);

    const list = await request(server)
      .get(
        `/api/v1/trips/${tripId}/items?page=1&pageSize=10&sortField=startAt&sortDir=asc`,
      )
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(list.body.pagination.total).toBeGreaterThanOrEqual(1);
    expect(list.body.data[0]).toHaveProperty('votesCount', 0);
  });

  it('VIEWER no puede crear (403 TRIP_FORBIDDEN)', async () => {
    const owner = await registerLogin(server, 'items_owner_2@test.com');
    const viewer = await registerLogin(server, 'items_viewer_2@test.com');
    const tripId = await createTrip(server, owner.token, 'Trip Items B');
    await inviteAndAccept(server, tripId, owner.token, viewer, 'VIEWER');

    const res = await request(server)
      .post(`/api/v1/trips/${tripId}/items`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .send({ type: 'NOTE', title: 'Apunte', timezone: 'Europe/Madrid' })
      .expect(403);

    expect(res.body.error.code).toBe('TRIP_FORBIDDEN');
  });

  it('AUTHOR puede editar/borrar su item aunque luego sea VIEWER', async () => {
    const owner = await registerLogin(server, 'items_owner_3@test.com');
    const editor = await registerLogin(server, 'items_editor_3@test.com');
    const tripId = await createTrip(server, owner.token, 'Trip Items C');

    // editor entra como EDITOR
    await inviteAndAccept(server, tripId, owner.token, editor, 'EDITOR');

    // editor crea item
    const created = await request(server)
      .post(`/api/v1/trips/${tripId}/items`)
      .set('Authorization', `Bearer ${editor.token}`)
      .send({ type: 'NOTE', title: 'Borrable', timezone: 'Europe/Madrid' })
      .expect(201);

    // owner lo degrada a VIEWER
    const editorUserId = await findMemberUserIdByEmail(
      server,
      tripId,
      owner.token,
      editor.email,
    );
    await request(server)
      .patch(`/api/v1/trips/${tripId}/members/${editorUserId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ role: 'VIEWER' })
      .expect(200);

    // como VIEWER, el autor aún puede editar
    const upd = await request(server)
      .patch(`/api/v1/trips/${tripId}/items/${created.body.id}`)
      .set('Authorization', `Bearer ${editor.token}`)
      .send({ title: 'Borrable (editado)' })
      .expect(200);
    expect(upd.body.title).toBe('Borrable (editado)');

    // y borrar
    await request(server)
      .delete(`/api/v1/trips/${tripId}/items/${created.body.id}`)
      .set('Authorization', `Bearer ${editor.token}`)
      .expect(204);

    // ya no existe
    const missing = await request(server)
      .get(`/api/v1/trips/${tripId}/items/${created.body.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(404);
    expect(missing.body.error.code).toBe('ITEM_NOT_FOUND');
  });

  it('Validación: startAt > endAt → 400 VALIDATION_ERROR', async () => {
    const owner = await registerLogin(server, 'items_owner_4@test.com');
    const tripId = await createTrip(server, owner.token, 'Trip Items D');

    const res = await request(server)
      .post(`/api/v1/trips/${tripId}/items`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        type: 'ACTIVITY',
        title: 'Fechas Mal',
        startAt: '2025-06-03T12:00:00Z',
        endAt: '2025-06-03T09:00:00Z',
        timezone: 'Europe/Madrid',
      })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('Validación: fuera de rango del trip → 400 VALIDATION_ERROR', async () => {
    const owner = await registerLogin(server, 'items_owner_5@test.com');
    const tripId = await createTrip(server, owner.token, 'Trip Items E');

    const res = await request(server)
      .post(`/api/v1/trips/${tripId}/items`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        type: 'PLACE',
        title: 'Fuera de rango',
        startAt: '2025-05-31T23:00:00Z',
        endAt: '2025-06-01T02:00:00Z',
        timezone: 'Europe/Madrid',
      })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('Listado: paginación, orden y filtro por día', async () => {
    const owner = await registerLogin(server, 'items_owner_6@test.com');
    const tripId = await createTrip(server, owner.token, 'Trip Items F');

    // Día 2 (dos items)
    await request(server)
      .post(`/api/v1/trips/${tripId}/items`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        type: 'ACTIVITY',
        title: 'D2 - mañana',
        startAt: '2025-06-02T08:00:00Z',
        endAt: '2025-06-02T10:00:00Z',
        timezone: 'Europe/Madrid',
      })
      .expect(201);

    await request(server)
      .post(`/api/v1/trips/${tripId}/items`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        type: 'ACTIVITY',
        title: 'D2 - tarde',
        startAt: '2025-06-02T16:00:00Z',
        endAt: '2025-06-02T18:00:00Z',
        timezone: 'Europe/Madrid',
      })
      .expect(201);

    // Día 3
    await request(server)
      .post(`/api/v1/trips/${tripId}/items`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        type: 'ACTIVITY',
        title: 'D3 - mañana',
        startAt: '2025-06-03T08:00:00Z',
        endAt: '2025-06-03T10:00:00Z',
        timezone: 'Europe/Madrid',
      })
      .expect(201);

    // Filtro por día 2025-06-02
    const d2 = await request(server)
      .get(
        `/api/v1/trips/${tripId}/items?date=2025-06-02&sortField=startAt&sortDir=asc`,
      )
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    expect(d2.body.data.length).toBe(2);
    expect(d2.body.data[0].title).toBe('D2 - mañana');
    expect(d2.body.pagination.total).toBe(2);

    // Paginación simple
    const page1 = await request(server)
      .get(
        `/api/v1/trips/${tripId}/items?page=1&pageSize=2&sortField=startAt&sortDir=asc`,
      )
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    const page2 = await request(server)
      .get(
        `/api/v1/trips/${tripId}/items?page=2&pageSize=2&sortField=startAt&sortDir=asc`,
      )
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    expect(page1.body.data.length).toBe(2);
    expect(page2.body.data.length).toBeGreaterThanOrEqual(1);
    expect(page1.body.pagination.total).toBeGreaterThanOrEqual(3);
  });
});
