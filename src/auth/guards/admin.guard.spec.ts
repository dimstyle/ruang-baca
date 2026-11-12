import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { PrismaService } from '@ruangbaca/database';
import { AdminGuard } from './admin.guard';

jest.mock('@ruangbaca/database', () => ({ PrismaService: class {} }));

describe('AdminGuard', () => {
  const $queryRawUnsafe = jest.fn();
  const guard = new AdminGuard({
    $queryRawUnsafe,
  } as unknown as PrismaService);

  const ctx = (user?: { sub: string; email: string }) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;
  const admin = { sub: 'acc-admin', email: 'a@x.id' };

  beforeEach(() => $queryRawUnsafe.mockReset());

  it('allows an account with role admin', async () => {
    $queryRawUnsafe.mockResolvedValue([{ id: 'acc-admin', role: 'admin' }]);
    await expect(guard.canActivate(ctx(admin))).resolves.toBe(true);
    expect($queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('SELECT id, role'),
      'acc-admin',
    );
  });

  it('rejects an account with role user', async () => {
    $queryRawUnsafe.mockResolvedValue([{ id: 'acc-admin', role: 'user' }]);
    await expect(guard.canActivate(ctx(admin))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects when the account no longer exists', async () => {
    $queryRawUnsafe.mockResolvedValue([]);
    await expect(guard.canActivate(ctx(admin))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects when there is no authenticated user', async () => {
    await expect(guard.canActivate(ctx())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect($queryRawUnsafe).not.toHaveBeenCalled();
  });
});
