import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { PrismaService } from '@ruangbaca/database';
import { AdminGuard } from './admin.guard';

jest.mock('@ruangbaca/database', () => ({ PrismaService: class {} }));

describe('AdminGuard', () => {
  const findUnique = jest.fn();
  const guard = new AdminGuard({
    account: { findUnique },
  } as unknown as PrismaService);

  const ctx = (user?: { sub: string; email: string }) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;
  const admin = { sub: 'acc-admin', email: 'a@x.id' };

  beforeEach(() => findUnique.mockReset());

  it('allows an account with role admin', async () => {
    findUnique.mockResolvedValue({ id: 'acc-admin', role: 'admin' });
    await expect(guard.canActivate(ctx(admin))).resolves.toBe(true);
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 'acc-admin' } });
  });

  it('rejects an account with role user', async () => {
    findUnique.mockResolvedValue({ id: 'acc-admin', role: 'user' });
    await expect(guard.canActivate(ctx(admin))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects when the account no longer exists', async () => {
    findUnique.mockResolvedValue(null);
    await expect(guard.canActivate(ctx(admin))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects when there is no authenticated user', async () => {
    await expect(guard.canActivate(ctx())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(findUnique).not.toHaveBeenCalled();
  });
});
