import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { validateEnv } from './config/env.validation';
import { ThrottlerModule } from '@nestjs/throttler';
import { UtilitiesModule } from './utilities/utilities.module';

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
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
