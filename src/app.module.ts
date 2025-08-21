import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

import { UtilitiesModule } from './utilities/utilities.module';
import { PrismaModule } from './database/prisma.module';

import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60,
          limit: 60,
        },
      ],
    }),
    UtilitiesModule,
    PrismaModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
