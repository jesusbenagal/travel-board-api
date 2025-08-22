import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JsonWebTokenError, JwtService, TokenExpiredError } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { PrismaService } from '../../database/prisma.service';

import { LoginDto, RefreshDto, RegisterDto } from './dto';

import type { TokenPair } from './types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private signTokens(user: { id: string; email: string }): TokenPair {
    const accessTtl = this.config.get<number>('JWT_ACCESS_TTL') ?? 900;
    const refreshTtl = this.config.get<number>('JWT_REFRESH_TTL') ?? 604800;
    const iss = 'travel-board-api';

    const accessToken = this.jwt.sign(
      { sub: user.id, email: user.email, tokenType: 'access' },
      {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: accessTtl,
        issuer: iss,
        audience: 'access',
      },
    );

    const refreshToken = this.jwt.sign(
      { sub: user.id, email: user.email, tokenType: 'refresh' },
      {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshTtl,
        audience: 'refresh',
        issuer: iss,
      },
    );

    return { accessToken, refreshToken };
  }

  async register(dto: RegisterDto) {
    try {
      const passwordHash = await bcrypt.hash(dto.password, 10);

      const user = await this.prisma.user.create({
        data: {
          email: dto.email.toLocaleLowerCase(),
          passwordHash,
          name: dto.name,
        },
        select: {
          id: true,
          email: true,
          name: true,
        },
      });

      const tokens = this.signTokens(user);

      return {
        user,
        ...tokens,
      };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'VALIDATION_ERROR',
          message: 'Email already exists',
          details: { email: 'taken' },
        });
      }
      throw e;
    }
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user) {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Invalid credentials',
      });
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Invalid credentials',
      });
    }

    const tokens = this.signTokens(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      ...tokens,
    };
  }

  async refresh(dto: RefreshDto) {
    try {
      const iss = 'travel-board-api';

      const payload = await this.jwt.verifyAsync<{
        sub: string;
        email: string;
        tokenType?: string;
      }>(dto.refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        issuer: iss,
        audience: 'refresh',
      });

      if (payload.tokenType !== 'refresh') {
        throw new UnauthorizedException({
          code: 'AUTH_FORBIDDEN',
          message: 'Invalid token type',
        });
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, name: true },
      });

      if (!user) {
        throw new UnauthorizedException({
          code: 'AUTH_FORBIDDEN',
          message: 'User not found',
        });
      }

      const tokens = this.signTokens({ id: user.id, email: user.email });

      return tokens;
    } catch (err: any) {
      if (err instanceof TokenExpiredError) {
        throw new UnauthorizedException({
          code: 'AUTH_TOKEN_EXPIRED',
          message: 'Refresh token expired',
        });
      }
      if (
        err instanceof JsonWebTokenError ||
        (err as { name?: string }).name === 'JsonWebTokenError'
      ) {
        throw new UnauthorizedException({
          code: 'AUTH_FORBIDDEN',
          message: 'Invalid refresh token',
        });
      }
      throw err;
    }
  }
}
