// test/e2e/share-links.e2e-spec.ts
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Server } from 'http';

import { buildTestApp } from '../utils/test-app';
import { resetTestDb } from '../utils/test-db';

import { PrismaService } from '../../src/database/prisma.service';

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
  title = 'Shared Trip',
): Promise<string> {
  const res = await request(server)
    .post('/api/v1/trips')
    .set('Authorization', `Bearer ${token}`)
    .send({
      title,
      description: 'public-share',
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
  title = 'Note A',
): Promise<string> {
  const res = await request(server)
    .post(`/api/v1/trips/${tripId}/items`)
    .set('Authorization', `Bearer ${token}`)
    .send({ type: 'NOTE', title, timezone: 'Europe/Madrid' })
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

describe('v0.6 Share Links (E2E)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;

  beforeAll(async () => {
    resetTestDb();
    app = await buildTestApp();
    server = app.getHttpServer();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('OWNER crea link, lista, y público puede leer trip + items', async () => {
    const owner = await registerLogin(server, 'share_owner_1@test.com');
    const tripId = await createTrip(server, owner.token, 'Trip Share A');
    await createItem(server, owner.token, tripId, 'Public note');

    // crea link
    const created = await request(server)
      .post(`/api/v1/trips/${tripId}/share-links`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ maxUses: 3, note: 'Public itinerary' })
      .expect(201);

    expect(created.body).toMatchObject({
      tripId,
      isActive: true,
      uses: 0,
      maxUses: 3,
      note: 'Public itinerary',
    });
    const slug: string = created.body.slug;
    expect(typeof slug).toBe('string');

    // lista
    const listed = await request(server)
      .get(`/api/v1/trips/${tripId}/share-links`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    expect(Array.isArray(listed.body)).toBe(true);
    expect(listed.body[0].slug).toBe(slug);

    // público: obtiene trip
    const pub = await request(server)
      .get(`/api/v1/public/share/${slug}/trip`)
      .expect(200);
    expect(pub.body.trip.id).toBe(tripId);
    expect(Array.isArray(pub.body.items)).toBe(true);
    expect(pub.body.items.length).toBeGreaterThanOrEqual(1);

    // uses incrementa (verificamos en DB)
    const linkRow = await prisma.shareLink.findUnique({ where: { slug } });
    expect(linkRow?.uses).toBe(1);
  });

  it('EDITOR/VIEWER no pueden crear ni listar (403 TRIP_FORBIDDEN)', async () => {
    const owner = await registerLogin(server, 'share_owner_2@test.com');
    const editor = await registerLogin(server, 'share_editor_2@test.com');
    const viewer = await registerLogin(server, 'share_viewer_2@test.com');

    const tripId = await createTrip(server, owner.token, 'Trip Share B');

    await inviteAndAccept(server, tripId, owner.token, editor, 'EDITOR');
    await inviteAndAccept(server, tripId, owner.token, viewer, 'VIEWER');

    // crear como EDITOR → 403
    await request(server)
      .post(`/api/v1/trips/${tripId}/share-links`)
      .set('Authorization', `Bearer ${editor.token}`)
      .send({})
      .expect(403);

    // listar como VIEWER → 403
    await request(server)
      .get(`/api/v1/trips/${tripId}/share-links`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .expect(403);
  });

  it('Revocar: 204 y luego public devuelve 404 SHARE_INVALID', async () => {
    const owner = await registerLogin(server, 'share_owner_3@test.com');
    const tripId = await createTrip(server, owner.token, 'Trip Share C');

    const created = await request(server)
      .post(`/api/v1/trips/${tripId}/share-links`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({})
      .expect(201);

    const linkId = String(created.body.id);
    const slug = String(created.body.slug);

    // revoke
    await request(server)
      .delete(`/api/v1/trips/${tripId}/share-links/${linkId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(204);

    // público falla
    const pub = await request(server)
      .get(`/api/v1/public/share/${slug}/trip`)
      .expect(404);
    expect(pub.body.error.code).toBe('SHARE_INVALID');
  });

  it('maxUses: al superar el límite → 403 SHARE_MAXED', async () => {
    const owner = await registerLogin(server, 'share_owner_4@test.com');
    const tripId = await createTrip(server, owner.token, 'Trip Share D');

    const created = await request(server)
      .post(`/api/v1/trips/${tripId}/share-links`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ maxUses: 2 })
      .expect(201);

    const slug = String(created.body.slug);

    // 1ª & 2ª OK
    await request(server).get(`/api/v1/public/share/${slug}/trip`).expect(200);
    await request(server).get(`/api/v1/public/share/${slug}/trip`).expect(200);
    // 3ª → maxed
    const third = await request(server)
      .get(`/api/v1/public/share/${slug}/trip`)
      .expect(403);
    expect(third.body.error.code).toBe('SHARE_MAXED');
  });

  it('expiresAt: si expira → 403 SHARE_EXPIRED', async () => {
    const owner = await registerLogin(server, 'share_owner_5@test.com');
    const tripId = await createTrip(server, owner.token, 'Trip Share E');

    // Creamos un link válido y luego lo marcamos como expirado desde Prisma
    const created = await request(server)
      .post(`/api/v1/trips/${tripId}/share-links`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ maxUses: 5 })
      .expect(201);

    const slug = String(created.body.slug);
    await prisma.shareLink.update({
      where: { id: String(created.body.id) },
      data: { expiresAt: new Date(Date.now() - 1000) }, // pasado
    });

    const res = await request(server)
      .get(`/api/v1/public/share/${slug}/trip`)
      .expect(403);
    expect(res.body.error.code).toBe('SHARE_EXPIRED');
  });
});
