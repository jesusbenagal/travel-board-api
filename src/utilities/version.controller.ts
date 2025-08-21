import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

@ApiTags('Utilities')
@Controller('version')
export class VersionController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  version() {
    return {
      version: this.configService.get<string>('APP_VERSION'),
      commit: this.configService.get<string>('COMMIT_SHA'),
      buildAt: new Date().toISOString(),
    };
  }
}
