import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

export type AccessTokenPayload = { sub: string; email: string };

// specs/conf-spec/jwt-conf-spec.md: JWT is always read from http-only cookies,
// never from the Authorization header.
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) =>
          (req?.cookies?.access_token as string | undefined) ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET_KEY as string,
    });
  }

  validate(payload: Partial<AccessTokenPayload>): AccessTokenPayload {
    // Refresh tokens share the secret but carry only `sub`; reject them here.
    if (!payload.sub || !payload.email) throw new UnauthorizedException();
    return { sub: payload.sub, email: payload.email };
  }
}
