import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { CookieOptions, Request, Response } from 'express';
import {
  ACCESS_TOKEN_TTL_MS,
  AuthService,
  AuthTokens,
  REFRESH_TOKEN_TTL_MS,
} from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { AccessTokenPayload } from './strategies/jwt.strategy';

const baseCookie: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
};

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('registration')
  async register(@Body() dto: RegisterDto) {
    await this.authService.register(dto);
    return { message: 'account created' };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    setAuthCookies(res, await this.authService.login(dto));
    return { message: 'login success' };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  async logout(
    @Req() req: Request & { user: AccessTokenPayload },
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(
      req.user.sub,
      req.cookies?.refresh_token as string | undefined,
    );
    res.clearCookie('access_token', baseCookie);
    res.clearCookie('refresh_token', baseCookie);
    return { message: 'logout success' };
  }

  @Post('refresh_token')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.refresh(
      req.cookies?.refresh_token as string | undefined,
    );
    setAuthCookies(res, tokens);
    return { message: 'token refreshed' };
  }
}

function setAuthCookies(res: Response, tokens: AuthTokens) {
  res.cookie('access_token', tokens.access_token, {
    ...baseCookie,
    maxAge: ACCESS_TOKEN_TTL_MS,
  });
  res.cookie('refresh_token', tokens.refresh_token, {
    ...baseCookie,
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
}
