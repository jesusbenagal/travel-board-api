import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/database/prisma.service';
import { ShareLinksService } from '../../src/modules/share-links/share-links.service';

export interface SeedTripWithShareResult {
  owner: { id: string; email: string; password: string; token: string };
  tripId: string;
  slug: string;
}

/**
 * Crea un usuario owner, realiza login, crea un trip y genera un share-link.
 * Intenta primero vía HTTP; si la ruta no existe, usa el servicio Nest como fallback.
 */
export async function seedTripWithShare(
  app: INestApplication,
): Promise<SeedTripWithShareResult> {
  const server = app.getHttpServer();

  // 1) Owner register + login
  const email = `owner_${Date.now()}@test.com`;
  const password = 'P@ssw0rd1!';

  await request(server)
    .post('/api/v1/auth/register')
    .send({ email, password, name: 'Owner Seed' })
    .expect(201);

  const login = await request(server)
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);

  const token: string =
    (login.body?.accessToken as string) ?? (login.body?.access_token as string);
  const ownerId: string = (login.body?.user?.id as string) ?? '';

  // 2) Crea trip (sin items; no son necesarios para throttle/etag)
  const tripRes = await request(server)
    .post('/api/v1/trips')
    .set('Authorization', `Bearer ${token}`)
    .send({
      title: 'Seed Trip',
      description: 'Trip seeded for tests',
      startDate: '2025-01-01',
      endDate: '2025-01-05',
      timezone: 'Europe/Madrid',
    })
    .expect(201);

  const tripId: string =
    (tripRes.body?.id as string) ?? (tripRes.body?.trip?.id as string);

  // 3) Crea share-link (HTTP si existe la ruta)
  let slug: string | undefined;
  try {
    const createLinkHttp = await request(server)
      .post('/api/v1/share-links')
      .set('Authorization', `Bearer ${token}`)
      .send({ tripId, maxUses: 30 }) // ajusta payload si tu DTO cambia
      .expect((res) => {
        // si 404/405/403 saltará al catch y haremos fallback por servicio
        if (!res.body?.slug) throw new Error('no-slug');
      });

    slug = createLinkHttp.body.slug as string;
  } catch {
    // 3b) Fallback por servicio (cuando aún no tienes ruta pública de creación)
    const prisma = app.get(PrismaService);
    const links = app.get(ShareLinksService);

    // ownerId puede venir vacío si tu login no devuelve user; lo resolvemos por email
    const resolvedOwnerId =
      ownerId ||
      (await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      }))!.id;

    const link = await links.create(tripId, resolvedOwnerId, {
      maxUses: 30,
    });
    slug = link.slug;
  }

  return {
    owner: { id: ownerId, email, password, token },
    tripId,
    slug: slug!,
  };
}
