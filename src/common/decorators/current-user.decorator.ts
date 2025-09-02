import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

export interface AuthUser {
  userId: string;
  email: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest<{ user?: Partial<AuthUser> }>();
    const user = req.user;

    if (!user?.userId || !user?.email) {
      throw new UnauthorizedException('Auth user not present in the request');
    }

    return {
      userId: user.userId,
      email: user.email,
    };
  },
);
