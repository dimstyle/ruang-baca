import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, PrismaService } from '@ruangbaca/database';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SALT_ROUNDS = 10;

export type AuthTokens = { access_token: string; refresh_token: string };

const sqlDir = join(__dirname, 'sql');
const queries = Object.fromEntries(
  readdirSync(sqlDir)
    .filter((f) => f.endsWith('.queries.sql'))
    .flatMap((f) =>
      readFileSync(join(sqlDir, f), 'utf8')
        .split(/^--\s*name:\s*/m)
        .slice(1)
        .map((b) => {
          const i = b.indexOf('\n');
          return [b.slice(0, i).trim(), b.slice(i + 1).trim()];
        }),
    ),
);

const isUniqueError = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError &&
  (e.code === 'P2002' || e.message.includes('UNIQUE'));

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<void> {
    try {
      const password = await bcrypt.hash(dto.password, SALT_ROUNDS);
      const accountId = randomUUID();
      const userId = randomUUID();
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          queries.insertAccount,
          accountId,
          dto.username,
          dto.email,
          password,
        );
        await tx.$executeRawUnsafe(
          queries.insertUser,
          userId,
          accountId,
          dto.nama_lengkap,
          dto.no_hp,
          dto.alamat,
        );
      });
      this.logger.log(`Account and user registered: ${accountId}`);
    } catch (e) {
      if (isUniqueError(e)) {
        this.logger.warn(`Registration rejected, duplicate: ${dto.email}`);
        throw new ConflictException('user data already exists');
      }
      throw this.unexpected('register', e);
    }
  }

  async login(dto: LoginDto): Promise<AuthTokens> {
    const [account] = await this.prisma.$queryRawUnsafe<
      Array<{ id: string; email: string; password: string }>
    >(queries.findAccountByEmail, dto.email);
    if (!account) {
      this.logger.warn(`Login failed, user not found: ${dto.email}`);
      throw new NotFoundException('user not found');
    }

    const valid = await bcrypt.compare(dto.password, account.password);
    if (!valid) {
      this.logger.warn(`Login failed, wrong password: ${dto.email}`);
      throw new UnauthorizedException('username or password wrong');
    }

    try {
      const tokens = await this.signTokens(account.id, account.email);
      await this.prisma.$executeRawUnsafe(
        queries.insertRefreshToken,
        account.id,
        tokens.refresh_token,
        new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      );
      this.logger.log(`Login success: ${account.id}`);
      return tokens;
    } catch (e) {
      throw this.unexpected('login', e);
    }
  }

  async logout(accountId: string, refreshToken?: string): Promise<void> {
    try {
      const count = await this.prisma.$executeRawUnsafe(
        queries.deleteRefreshToken,
        accountId,
        refreshToken ?? '',
      );
      this.logger.log(`Logout: ${accountId} (${count} refresh token removed)`);
    } catch (e) {
      throw this.unexpected('logout', e);
    }
  }

  async refresh(refreshToken?: string): Promise<AuthTokens> {
    if (!refreshToken) {
      this.logger.warn('Refresh rejected, no refresh_token cookie');
      throw new UnauthorizedException();
    }

    let sub: string;
    try {
      ({ sub } = await this.jwt.verifyAsync<{ sub: string }>(refreshToken));
    } catch {
      this.logger.warn('Refresh rejected, invalid refresh_token');
      throw new UnauthorizedException();
    }

    const [stored] = await this.prisma.$queryRawUnsafe<
      Array<{ id: number; email: string }>
    >(queries.findValidRefreshToken, refreshToken, sub, new Date());
    if (!stored) {
      this.logger.warn(`Refresh rejected, token not found: ${sub}`);
      throw new NotFoundException('token not found');
    }

    try {
      const tokens = await this.signTokens(sub, stored.email);
      await this.prisma.$executeRawUnsafe(
        queries.updateRefreshToken,
        tokens.refresh_token,
        new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        stored.id,
      );
      this.logger.log(`Token refreshed: ${sub}`);
      return tokens;
    } catch (e) {
      throw this.unexpected('refresh', e);
    }
  }

  private async signTokens(sub: string, email: string): Promise<AuthTokens> {
    const [access_token, refresh_token] = await Promise.all([
      this.jwt.signAsync(
        { sub, email },
        { expiresIn: ACCESS_TOKEN_TTL_MS / 1000 },
      ),
      this.jwt.signAsync({ sub }, { expiresIn: REFRESH_TOKEN_TTL_MS / 1000 }),
    ]);
    return { access_token, refresh_token };
  }

  private unexpected(action: string, e: unknown) {
    this.logger.error(
      `Unexpected error during ${action}`,
      e instanceof Error ? e.stack : String(e),
    );
    return new InternalServerErrorException('internal server error');
  }
}
