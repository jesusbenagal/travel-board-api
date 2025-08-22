import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { AuthService } from './auth.service';

import { LoginDto, RefreshDto, RegisterDto } from './dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @Throttle({ default: { limit: 10, ttl: 60 } })
  async register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'User login (issue access & refresh)' })
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60, limit: 20 } })
  async login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Rotate tokens using refresh token' })
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60, limit: 30 } })
  async refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto);
  }
}
