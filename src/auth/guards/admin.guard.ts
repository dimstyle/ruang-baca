import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '@ruangbaca/database';
import type { AccessTokenPayload } from '../strategies/jwt.strategy';

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
    const account = user
      ? await this.prisma.account.findUnique({ where: { id: user.sub } })
      : null;

    if (account?.role !== 'admin') {
      this.logger.warn(`Admin access rejected: ${user?.sub ?? 'anonymous'}`);
      throw new UnauthorizedException();
    }
    return true;
  }
}
