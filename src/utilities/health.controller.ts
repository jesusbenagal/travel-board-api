import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Utilities')
@Controller('health')
export class HealthController {
  @Get()
  health() {
    return {
      status: 'ok',
      uptimeMs: Math.round(process.uptime() * 1000),
      db: 'unknown', //TODO: add db check health
    };
  }
}
