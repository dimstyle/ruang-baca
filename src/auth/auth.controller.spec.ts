import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@ruangbaca/database';
import type { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AdminGuard } from './guards/admin.guard';

jest.mock('@ruangbaca/database', () => ({
  PrismaService: class {},
  Prisma: { PrismaClientKnownRequestError: class {} },
}));

describe('AuthController', () => {
  let controller: AuthController;
  const authService = {
    register: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    refresh: jest.fn(),
  };
  const tokens = { access_token: 'access', refresh_token: 'refresh' };

  type MockRes = { cookie: jest.Mock; clearCookie: jest.Mock };
  const mockRes = (): MockRes => ({
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  });
  const asRes = (res: MockRes) => res as unknown as Response;

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: PrismaService, useValue: {} }, // needed by AdminGuard
      ],
    }).compile();

    controller = module.get(AuthController);
  });

  describe('POST /registration', () => {
    it('is restricted to authenticated admins', () => {
      const guards = Reflect.getMetadata(
        GUARDS_METADATA,
        // only reading decorator metadata, the method is never called
        // eslint-disable-next-line @typescript-eslint/unbound-method
        AuthController.prototype.register,
      ) as unknown[];
      expect(guards).toContain(AdminGuard);
      expect(guards).toHaveLength(2); // AuthGuard('jwt') runs first
    });

    it('creates the account and returns the message', async () => {
      const dto = { username: 'budi', email: 'b@x.id', password: 'secret123' };
      await expect(controller.register(dto)).resolves.toEqual({
        message: 'account created',
      });
      expect(authService.register).toHaveBeenCalledWith(dto);
    });
  });

  describe('POST /login', () => {
    const dto = { email: 'b@x.id', password: 'secret123' };

    it('sets http-only access_token and refresh_token cookies', async () => {
      authService.login.mockResolvedValue(tokens);
      const res = mockRes();

      await controller.login(dto, asRes(res));

      expect(res.cookie).toHaveBeenCalledTimes(2);
      expect(res.cookie).toHaveBeenCalledWith(
        'access_token',
        'access',
        expect.objectContaining({ httpOnly: true }),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'refresh',
        expect.objectContaining({ httpOnly: true }),
      );
    });

    it('propagates 404 user not found', async () => {
      authService.login.mockRejectedValue(new NotFoundException());
      const res = mockRes();
      await expect(controller.login(dto, asRes(res))).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(res.cookie).not.toHaveBeenCalled();
    });

    it('propagates 401 wrong password', async () => {
      authService.login.mockRejectedValue(new UnauthorizedException());
      await expect(
        controller.login(dto, asRes(mockRes())),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('POST /logout', () => {
    it('removes the refresh token and clears both cookies', async () => {
      const req = {
        user: { sub: 'acc-1', email: 'b@x.id' },
        cookies: { refresh_token: 'refresh' },
      } as unknown as Request & { user: { sub: string; email: string } };
      const res = mockRes();

      await controller.logout(req, asRes(res));

      expect(authService.logout).toHaveBeenCalledWith('acc-1', 'refresh');
      expect(res.clearCookie).toHaveBeenCalledWith(
        'access_token',
        expect.anything(),
      );
      expect(res.clearCookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.anything(),
      );
    });
  });

  describe('POST /refresh_token', () => {
    it('sets new cookies from the refresh_token cookie', async () => {
      authService.refresh.mockResolvedValue(tokens);
      const req = { cookies: { refresh_token: 'old' } } as unknown as Request;
      const res = mockRes();

      await controller.refresh(req, asRes(res));

      expect(authService.refresh).toHaveBeenCalledWith('old');
      expect(res.cookie).toHaveBeenCalledTimes(2);
    });

    it('propagates 401 when the cookie is missing', async () => {
      authService.refresh.mockRejectedValue(new UnauthorizedException());
      const req = { cookies: {} } as unknown as Request;
      await expect(
        controller.refresh(req, asRes(mockRes())),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(authService.refresh).toHaveBeenCalledWith(undefined);
    });

    it('propagates 404 token not found', async () => {
      authService.refresh.mockRejectedValue(new NotFoundException());
      const req = { cookies: { refresh_token: 'gone' } } as unknown as Request;
      await expect(
        controller.refresh(req, asRes(mockRes())),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
