import {
  PrismaClient,
  Role,
  InviteStatus,
  ItemType,
  Visibility,
} from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const owner = await prisma.user.upsert({
    where: { email: 'owner050@example.com' },
    update: {},
    create: {
      email: 'owner050@example.com',
      passwordHash: 'x',
      name: 'Owner 050',
    },
  });

  const trip = await prisma.trip.create({
    data: {
      ownerId: owner.id,
      title: 'v0.5 Seed Trip',
      startDate: new Date('2025-06-01T00:00:00Z'),
      endDate: new Date('2025-06-07T00:00:00Z'),
      timezone: 'Europe/Madrid',
      visibility: Visibility.PRIVATE,
      members: {
        create: { userId: owner.id, role: 'OWNER', status: 'ACCEPTED' },
      },
    },
  });

  await prisma.invite.create({
    data: {
      tripId: trip.id,
      invitedById: owner.id,
      email: 'viewer050@example.com',
      role: Role.VIEWER,
      status: InviteStatus.PENDING,
      token: 'demo-token-050',
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    },
  });

  await prisma.item.create({
    data: {
      tripId: trip.id,
      createdById: owner.id,
      type: ItemType.PLACE,
      title: 'Coliseo',
      notes: 'Comprar entradas online',
      startAt: new Date('2025-06-02T09:00:00Z'),
      endAt: new Date('2025-06-02T12:00:00Z'),
      timezone: 'Europe/Rome',
      locationName: 'Colosseo',
      url: 'https://parcocolosseo.it/',
      order: 1,
    },
  });

  console.log('Seed v0.5 OK', { trip: trip.title });
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises, @typescript-eslint/no-misused-promises
main().finally(async () => prisma.$disconnect());
