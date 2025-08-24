import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { buildTestApp } from '../utils/test-app';
import { resetTestDb } from '../utils/test-db';
import { Server } from 'http';

type AuthBundle = { token: string; userId: string; email: string };

async function registerLogin(
  server: Server,
  email: string,
): Promise<AuthBundle> {
  const password = 'Password123!';

  // register (idempotente en tests limpios; si existiera, login seguirá)
  await request(server)
    .post('/api/v1/auth/register')
    .send({ email, password })
    .expect((res) => {
      // 201 o 409 VALIDATION_ERROR si repites por accidente; no fallar aquí
      if (![201, 409].includes(res.status)) {
        throw new Error(`Unexpected status on register: ${res.status}`);
      }
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
  const userId = String(me.body.id);

  return { token, userId, email };
}

async function createTrip(
  server: Server,
  token: string,
  title = 'Trip v0.5',
): Promise<string> {
  const body = {
    title,
    description: 'collab',
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

describe('v0.5 Members & Invites (E2E)', () => {
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

  it('Owner invita → invite aparece en /me/invites → accept crea membresía → members lista al nuevo', async () => {
    // Owner y viewer
    const owner = await registerLogin(server, 'owner050@test.com');
    const viewer = await registerLogin(server, 'viewer050@test.com');

    const tripId = await createTrip(server, owner.token, 'Trip 050 A');

    // Crea invite (OWNER puede invitar como VIEWER)
    const invite = await request(server)
      .post(`/api/v1/trips/${tripId}/invites`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: viewer.email, role: 'VIEWER' })
      .expect(201);

    expect(invite.body.email).toBe(viewer.email);
    expect(invite.body.role).toBe('VIEWER');
    expect(invite.body.status).toBe('PENDING');

    // /me/invites (como viewer)
    const myInv = await request(server)
      .get('/api/v1/me/invites')
      .set('Authorization', `Bearer ${viewer.token}`)
      .expect(200);

    expect(Array.isArray(myInv.body.data)).toBe(true);
    expect(
      myInv.body.data.some((i: { tripId: string }) => i.tripId === tripId),
    ).toBe(true);

    // Accept (como viewer)
    await request(server)
      .post(`/api/v1/invites/${invite.body.id}/accept`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .expect(200);

    // List members (solo owner/editor) → incluirá al viewer
    const members = await request(server)
      .get(`/api/v1/trips/${tripId}/members`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    const emails: string[] = members.body.members.map(
      (m: { email: string }) => m.email,
    );
    expect(emails).toContain(viewer.email);
  });

  it('No permite duplicar invite PENDING al mismo email', async () => {
    const owner = await registerLogin(server, 'owner051@test.com');
    const invitee = await registerLogin(server, 'dup051@test.com');
    const tripId = await createTrip(server, owner.token, 'Trip 050 B');

    await request(server)
      .post(`/api/v1/trips/${tripId}/invites`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: invitee.email, role: 'VIEWER' })
      .expect(201);

    const dup = await request(server)
      .post(`/api/v1/trips/${tripId}/invites`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: invitee.email, role: 'VIEWER' })
      .expect(409);

    expect(dup.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('Editor NO puede invitar como EDITOR; sí puede como VIEWER', async () => {
    const owner = await registerLogin(server, 'owner052@test.com');
    const editorUser = await registerLogin(server, 'editor052@test.com');
    const thirdUser = await registerLogin(server, 'third052@test.com');

    const tripId = await createTrip(server, owner.token, 'Trip 050 C');

    // Owner invita a editorUser como EDITOR y lo acepta
    const inv = await request(server)
      .post(`/api/v1/trips/${tripId}/invites`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: editorUser.email, role: 'EDITOR' })
      .expect(201);

    await request(server)
      .post(`/api/v1/invites/${inv.body.id}/accept`)
      .set('Authorization', `Bearer ${editorUser.token}`)
      .expect(200);

    // Editor intenta invitar como EDITOR → 403
    const asEditorForbidden = await request(server)
      .post(`/api/v1/trips/${tripId}/invites`)
      .set('Authorization', `Bearer ${editorUser.token}`)
      .send({ email: thirdUser.email, role: 'EDITOR' })
      .expect(403);

    expect(asEditorForbidden.body.error.code).toBe('TRIP_FORBIDDEN');

    // Editor invita como VIEWER → 201
    await request(server)
      .post(`/api/v1/trips/${tripId}/invites`)
      .set('Authorization', `Bearer ${editorUser.token}`)
      .send({ email: thirdUser.email, role: 'VIEWER' })
      .expect(201);
  });

  it('Viewer no puede listar miembros (403), editor y owner sí (200)', async () => {
    const owner = await registerLogin(server, 'owner053@test.com');
    const editorUser = await registerLogin(server, 'editor053@test.com');
    const viewerUser = await registerLogin(server, 'viewer053@test.com');

    const tripId = await createTrip(server, owner.token, 'Trip 050 D');

    // Owner invita a editor y viewer; ambos aceptan
    const invE = await request(server)
      .post(`/api/v1/trips/${tripId}/invites`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: editorUser.email, role: 'EDITOR' })
      .expect(201);
    await request(server)
      .post(`/api/v1/invites/${invE.body.id}/accept`)
      .set('Authorization', `Bearer ${editorUser.token}`)
      .expect(200);

    const invV = await request(server)
      .post(`/api/v1/trips/${tripId}/invites`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: viewerUser.email, role: 'VIEWER' })
      .expect(201);
    await request(server)
      .post(`/api/v1/invites/${invV.body.id}/accept`)
      .set('Authorization', `Bearer ${viewerUser.token}`)
      .expect(200);

    // Viewer → 403
    const listAsViewer = await request(server)
      .get(`/api/v1/trips/${tripId}/members`)
      .set('Authorization', `Bearer ${viewerUser.token}`)
      .expect(403);
    expect(listAsViewer.body.error.code).toBe('TRIP_FORBIDDEN');

    // Editor → 200
    await request(server)
      .get(`/api/v1/trips/${tripId}/members`)
      .set('Authorization', `Bearer ${editorUser.token}`)
      .expect(200);

    // Owner → 200
    await request(server)
      .get(`/api/v1/trips/${tripId}/members`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
  });

  it('Aceptar invite dos veces → 409 INVITE_ALREADY_ACCEPTED', async () => {
    const owner = await registerLogin(server, 'owner054@test.com');
    const invitee = await registerLogin(server, 'invitee054@test.com');
    const tripId = await createTrip(server, owner.token, 'Trip 050 E');

    const inv = await request(server)
      .post(`/api/v1/trips/${tripId}/invites`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: invitee.email, role: 'VIEWER' })
      .expect(201);

    await request(server)
      .post(`/api/v1/invites/${inv.body.id}/accept`)
      .set('Authorization', `Bearer ${invitee.token}`)
      .expect(200);

    const again = await request(server)
      .post(`/api/v1/invites/${inv.body.id}/accept`)
      .set('Authorization', `Bearer ${invitee.token}`)
      .expect(409);

    expect(again.body.error.code).toBe('INVITE_ALREADY_ACCEPTED');
  });

  it('Aceptar invite con usuario de email distinto → 403 INVITE_FORBIDDEN', async () => {
    const owner = await registerLogin(server, 'owner055@test.com');
    const good = await registerLogin(server, 'good055@test.com');
    const bad = await registerLogin(server, 'bad055@test.com');

    const tripId = await createTrip(server, owner.token, 'Trip 050 F');

    const inv = await request(server)
      .post(`/api/v1/trips/${tripId}/invites`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: good.email, role: 'VIEWER' })
      .expect(201);

    const res = await request(server)
      .post(`/api/v1/invites/${inv.body.id}/accept`)
      .set('Authorization', `Bearer ${bad.token}`)
      .expect(403);

    expect(res.body.error.code).toBe('INVITE_FORBIDDEN');
  });

  it('Decline invite → /me/invites refleja status DECLINED', async () => {
    const owner = await registerLogin(server, 'owner056@test.com');
    const invitee = await registerLogin(server, 'decline056@test.com');
    const tripId = await createTrip(server, owner.token, 'Trip 050 G');

    const inv = await request(server)
      .post(`/api/v1/trips/${tripId}/invites`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: invitee.email, role: 'VIEWER' })
      .expect(201);

    await request(server)
      .post(`/api/v1/invites/${inv.body.id}/decline`)
      .set('Authorization', `Bearer ${invitee.token}`)
      .expect(200);

    const my = await request(server)
      .get('/api/v1/me/invites')
      .set('Authorization', `Bearer ${invitee.token}`)
      .expect(200);

    const row = (my.body.data as Array<{ id: string; status: string }>).find(
      (x) => x.id === inv.body.id,
    );
    expect(row?.status).toBe('DECLINED');
  });

  it('Owner puede cambiar rol y eliminar miembro; no puede eliminar OWNER', async () => {
    const owner = await registerLogin(server, 'owner057@test.com');
    const viewer = await registerLogin(server, 'viewer057@test.com');
    const tripId = await createTrip(server, owner.token, 'Trip 050 H');

    // Invita viewer y acepta
    const inv = await request(server)
      .post(`/api/v1/trips/${tripId}/invites`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: viewer.email, role: 'VIEWER' })
      .expect(201);
    await request(server)
      .post(`/api/v1/invites/${inv.body.id}/accept`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .expect(200);

    // Owner cambia rol a EDITOR
    const memberListBefore = await request(server)
      .get(`/api/v1/trips/${tripId}/members`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    const target = (
      memberListBefore.body.members as Array<{ email: string; userId: string }>
    ).find((m) => m.email === viewer.email);
    expect(target).toBeTruthy();

    const upd = await request(server)
      .patch(`/api/v1/trips/${tripId}/members/${target!.userId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ role: 'EDITOR' })
      .expect(200);
    expect(upd.body.role).toBe('EDITOR');

    // Owner elimina al miembro
    await request(server)
      .delete(`/api/v1/trips/${tripId}/members/${target!.userId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(204);

    // Intento de eliminar OWNER → 409 TRIP_FORBIDDEN
    const removeOwner = await request(server)
      .delete(`/api/v1/trips/${tripId}/members/${owner.userId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(409);
    expect(removeOwner.body.error.code).toBe('TRIP_FORBIDDEN');
  });
});
