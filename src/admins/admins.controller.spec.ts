import { ConflictException, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@ruangbaca/database';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminsController } from './admins.controller';
import { AdminsService } from './admins.service';

jest.mock('@ruangbaca/database', () => ({
  PrismaService: class {},
  Prisma: { PrismaClientKnownRequestError: class {} },
}));

describe('AdminsController', () => {
  let controller: AdminsController;
  const adminsService = {
    createUser: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
    getUser: jest.fn(),
  };
  const req = { user: { sub: 'acc-admin', email: 'a@x.id' } } as Parameters<
    AdminsController['createUser']
  >[0];

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminsController],
      providers: [
        { provide: AdminsService, useValue: adminsService },
        { provide: PrismaService, useValue: {} }, // needed by AdminGuard
      ],
    }).compile();

    controller = module.get(AdminsController);
  });

  it('is restricted to authenticated admins on every route', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AdminsController,
    ) as unknown[];
    expect(guards).toContain(AdminGuard);
    expect(guards).toHaveLength(2); // AuthGuard('jwt') runs first
  });

  describe('POST /createuser', () => {
    const dto = {
      id_user: 'acc-1',
      nama_lengkap: 'Budi',
      no_hp: '0812',
      alamat: 'Jl. Mawar',
    };

    it('creates the user data as the calling admin', async () => {
      await expect(controller.createUser(req, dto)).resolves.toEqual({
        message: 'user data has created',
      });
      expect(adminsService.createUser).toHaveBeenCalledWith('acc-admin', dto);
    });

    it('propagates 404 account not found', async () => {
      adminsService.createUser.mockRejectedValue(new NotFoundException());
      await expect(controller.createUser(req, dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('propagates 409 user data already exists', async () => {
      adminsService.createUser.mockRejectedValue(new ConflictException());
      await expect(controller.createUser(req, dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('PUT /updateuser', () => {
    const dto = { id_user: 'usr-1', alamat: 'Jl. Melati' };

    it('updates the user data', async () => {
      await expect(controller.updateUser(req, dto)).resolves.toEqual({
        message: 'data has updated',
      });
      expect(adminsService.updateUser).toHaveBeenCalledWith('acc-admin', dto);
    });

    it('propagates 404 User not found', async () => {
      adminsService.updateUser.mockRejectedValue(new NotFoundException());
      await expect(controller.updateUser(req, dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('DELETE /deleteuser', () => {
    const dto = { id_user: 'usr-1' };

    it('deletes the user', async () => {
      await expect(controller.deleteUser(req, dto)).resolves.toEqual({
        message: 'data has deleted',
      });
      expect(adminsService.deleteUser).toHaveBeenCalledWith(
        'acc-admin',
        'usr-1',
      );
    });

    it('propagates 404 User not found', async () => {
      adminsService.deleteUser.mockRejectedValue(new NotFoundException());
      await expect(controller.deleteUser(req, dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('propagates 409 when the user still has related records', async () => {
      adminsService.deleteUser.mockRejectedValue(new ConflictException());
      await expect(controller.deleteUser(req, dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('GET /getuser', () => {
    const dto = { id_user: 'usr-1' };

    it('returns the user data', async () => {
      const user = { id: 'usr-1', nama_lengkap: 'Budi' };
      adminsService.getUser.mockResolvedValue(user);
      await expect(controller.getUser(req, dto)).resolves.toEqual({
        message: 'User found',
        data: user,
      });
      expect(adminsService.getUser).toHaveBeenCalledWith('acc-admin', 'usr-1');
    });

    it('propagates 404 User not found', async () => {
      adminsService.getUser.mockRejectedValue(new NotFoundException());
      await expect(controller.getUser(req, dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
