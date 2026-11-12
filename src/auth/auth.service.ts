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
      const account = await this.prisma.account.create({
        data: {
          username: dto.username,
          email: dto.email,
          password,
          role: 'user',
          user: {
            create: {
              nama_lengkap: dto.nama_lengkap,
              no_hp: dto.no_hp,
              alamat: dto.alamat,
            },
          },
        },
      });
      this.logger.log(`Account and user registered: ${account.id}`);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        this.logger.warn(`Registration rejected, duplicate: ${dto.email}`);
        throw new ConflictException('user data already exists');
      }
      throw this.unexpected('register', e);
    }
  }

  async login(dto: LoginDto): Promise<AuthTokens> {
    const account = await this.prisma.account.findUnique({
      where: { email: dto.email },
    });
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
      await this.prisma.refreshToken.create({
        data: {
          account_id: account.id,
          token: tokens.refresh_token,
          expired_at: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        },
      });
      this.logger.log(`Login success: ${account.id}`);
      return tokens;
    } catch (e) {
      throw this.unexpected('login', e);
    }
  }

  async logout(accountId: string, refreshToken?: string): Promise<void> {
    try {
      const { count } = await this.prisma.refreshToken.deleteMany({
        where: { account_id: accountId, token: refreshToken ?? '' },
      });
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

    const stored = await this.prisma.refreshToken.findFirst({
      where: {
        token: refreshToken,
        account_id: sub,
        expired_at: { gt: new Date() },
      },
      include: { account: true },
    });
    if (!stored) {
      this.logger.warn(`Refresh rejected, token not found: ${sub}`);
      throw new NotFoundException('token not found');
    }

    try {
      const tokens = await this.signTokens(sub, stored.account.email);
      await this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: {
          token: tokens.refresh_token,
          expired_at: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        },
      });
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
