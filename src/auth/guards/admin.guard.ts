import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '@ruangbaca/database';
import type { AccessTokenPayload } from '../strategies/jwt.strategy';

const queries = Object.fromEntries(
  readFileSync(join(__dirname, '..', 'sql', 'auth.queries.sql'), 'utf8')
    .split(/^--\s*name:\s*/m)
    .slice(1)
    .map((b) => {
      const i = b.indexOf('\n');
      return [b.slice(0, i).trim(), b.slice(i + 1).trim()];
    }),
);

// Use after AuthGuard('jwt'). Role is read from the DB on every request so a
// revoked admin loses access immediately, not when the access token expires.
@Injectable()
export class AdminGuard implements CanActivate {
  private readonly logger = new Logger(AdminGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const { user } = ctx
      .switchToHttp()
      .getRequest<{ user?: AccessTokenPayload }>();
    const [account] = user
      ? await this.prisma.$queryRawUnsafe<Array<{ id: string; role: string }>>(
          queries.findAccountRoleById,
          user.sub,
        )
      : [];

    if (account?.role !== 'admin') {
      this.logger.warn(`Admin access rejected: ${user?.sub ?? 'anonymous'}`);
      throw new UnauthorizedException();
    }
    return true;
  }
}
