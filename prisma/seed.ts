import { PrismaClient, Role, MemberStatus, Visibility } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'owner@example.com';
  const plainPass = 'Password123';
  const passwordHash = await bcrypt.hash(plainPass, 10);

  // Upsert user
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash, name: 'Owner Seed' },
  });

  // Create trip if not exists
  const existingTrip = await prisma.trip.findFirst({
    where: { ownerId: user.id },
  });

  if (!existingTrip) {
    const start = new Date();
    const end = new Date();
    end.setDate(start.getDate() + 3);

    const trip = await prisma.trip.create({
      data: {
        ownerId: user.id,
        title: 'Viaje de ejemplo',
        description: 'Seed de desarrollo',
        startDate: start,
        endDate: end,
        timezone: 'Europe/Madrid',
        visibility: Visibility.PRIVATE,
      },
    });

    await prisma.tripMember.create({
      data: {
        tripId: trip.id,
        userId: user.id,
        role: Role.OWNER,
        status: MemberStatus.ACCEPTED,
      },
    });

    console.log('Seed OK ->', {
      user: user.email,
      trip: trip.title,
      login: { email, plainPass },
    });
  } else {
    console.log('Seed OK -> usuario ya tenía trips. Login:', {
      email,
      plainPass,
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect().catch(console.error);
  });
