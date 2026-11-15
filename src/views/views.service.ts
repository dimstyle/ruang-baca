import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@ruangbaca/database';
import type { Request, Response } from 'express';
import { setAuthCookies } from '../auth/auth.controller';
import { AuthService } from '../auth/auth.service';

const queries = Object.fromEntries(
  readFileSync(join(__dirname, 'sql', 'session.queries.sql'), 'utf8')
    .split(/^--\s*name:\s*/m)
    .slice(1)
    .map((b) => {
      const i = b.indexOf('\n');
      return [b.slice(0, i).trim(), b.slice(i + 1).trim()];
    }),
);

export type Session = {
  id: string;
  username: string;
  email: string;
  role: string;
  nama_lengkap: string;
};

@Injectable()
export class ViewsService {
  private readonly logger = new Logger(ViewsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
  ) {}

  // Resolves the logged-in account from cookies. An expired access token is
  // renewed server-side with the refresh token, so pages never need JS for it.
  async session(req: Request, res: Response): Promise<Session | null> {
    const cookies = (req.cookies ?? {}) as Record<string, string | undefined>;
    let sub: string | undefined;
    try {
      const p = await this.jwt.verifyAsync<{ sub?: string; email?: string }>(
        cookies.access_token ?? '',
      );
      if (p.email) sub = p.sub;
    } catch {
      // fall through to refresh
    }

    if (!sub && cookies.refresh_token) {
      try {
        const tokens = await this.auth.refresh(cookies.refresh_token);
        setAuthCookies(res, tokens);
        sub = this.jwt.decode<{ sub: string }>(tokens.access_token).sub;
      } catch {
        this.logger.warn('Page session refresh failed');
      }
    }
    if (!sub) return null;

    const [profile] = await this.prisma.$queryRawUnsafe<Session[]>(
      queries.findProfileByAccountId,
      sub,
    );
    return profile ?? null;
  }

  async badges() {
    const [row] = await this.prisma.$queryRawUnsafe<
      Array<{ peminjaman: bigint | number; pengembalian: bigint | number }>
    >(queries.countPendingRequests);
    return {
      peminjaman: Number(row?.peminjaman ?? 0),
      pengembalian: Number(row?.pengembalian ?? 0),
    };
  }
}
