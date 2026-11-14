import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@ruangbaca/database';
import { AdminGuard } from '../auth/guards/admin.guard';
import { PeminjamanController } from './peminjaman.controller';
import { PeminjamanService } from './peminjaman.service';

jest.mock('@ruangbaca/database', () => ({
  PrismaService: class {},
  Prisma: { PrismaClientKnownRequestError: class {} },
}));

describe('PeminjamanController', () => {
  let controller: PeminjamanController;
  const peminjamanService = {
    peminjaman: jest.fn(),
    pengembalian: jest.fn(),
    acceptPeminjaman: jest.fn(),
    acceptPengembalian: jest.fn(),
  };
  const userReq = {
    user: { sub: 'acc-user', email: 'u@x.id' },
  } as Parameters<PeminjamanController['peminjaman']>[0];
  const adminReq = {
    user: { sub: 'acc-admin', email: 'a@x.id' },
  } as Parameters<PeminjamanController['acceptPeminjaman']>[0];

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PeminjamanController],
      providers: [
        { provide: PeminjamanService, useValue: peminjamanService },
        { provide: PrismaService, useValue: {} }, // needed by AdminGuard
      ],
    }).compile();

    controller = module.get(PeminjamanController);
  });

  describe('POST /peminjaman', () => {
    it('requires JWT authentication (user or admin)', () => {
      const guards = Reflect.getMetadata(
        GUARDS_METADATA,
        // eslint-disable-next-line @typescript-eslint/unbound-method
        PeminjamanController.prototype.peminjaman,
      ) as unknown[];
      expect(guards).toHaveLength(1);
      expect(guards).not.toContain(AdminGuard);
    });

    const dto = {
      book_id: 1,
      tanggal_peminjaman: '2026-11-14T00:00:00.000Z',
    };

    it('records temp_peminjaman and returns admission wait message', async () => {
      await expect(controller.peminjaman(userReq, dto)).resolves.toEqual({
        message: 'Peminjaman success, wait for admin admission',
      });
      expect(peminjamanService.peminjaman).toHaveBeenCalledWith(
        'acc-user',
        dto,
      );
    });

    it('propagates 500 Internal server error', async () => {
      peminjamanService.peminjaman.mockRejectedValue(
        new InternalServerErrorException('Internal server error'),
      );
      await expect(controller.peminjaman(userReq, dto)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('POST /pengembalian', () => {
    it('requires JWT authentication (user or admin)', () => {
      const guards = Reflect.getMetadata(
        GUARDS_METADATA,
        // eslint-disable-next-line @typescript-eslint/unbound-method
        PeminjamanController.prototype.pengembalian,
      ) as unknown[];
      expect(guards).toHaveLength(1);
      expect(guards).not.toContain(AdminGuard);
    });

    const dto = {
      peminjaman_id: 10,
      tanggal_dikembalikan: '2026-11-20T00:00:00.000Z',
    };

    it('records temp_pengembalian and returns admission wait message', async () => {
      await expect(controller.pengembalian(userReq, dto)).resolves.toEqual({
        message: 'Pengembalian success, wait for admin admission',
      });
      expect(peminjamanService.pengembalian).toHaveBeenCalledWith(
        'acc-user',
        dto,
      );
    });

    it('propagates 404 Peminjaman not found', async () => {
      peminjamanService.pengembalian.mockRejectedValue(
        new NotFoundException('Peminjaman not found'),
      );
      await expect(
        controller.pengembalian(userReq, dto),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('propagates 500 Internal server error', async () => {
      peminjamanService.pengembalian.mockRejectedValue(
        new InternalServerErrorException('Internal server error'),
      );
      await expect(
        controller.pengembalian(userReq, dto),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('POST /acceptpeminjaman', () => {
    it('is restricted to authenticated admins', () => {
      const guards = Reflect.getMetadata(
        GUARDS_METADATA,
        // eslint-disable-next-line @typescript-eslint/unbound-method
        PeminjamanController.prototype.acceptPeminjaman,
      ) as unknown[];
      expect(guards).toContain(AdminGuard);
      expect(guards).toHaveLength(2);
    });

    const dto = {
      temp_peminjaman_id: 5,
      tanggal_batas_peminjaman: '2026-11-21T00:00:00.000Z',
    };

    it('admits peminjaman and returns "Peminjaman admission success"', async () => {
      await expect(controller.acceptPeminjaman(adminReq, dto)).resolves.toEqual(
        {
          message: 'Peminjaman admission success',
        },
      );
      expect(peminjamanService.acceptPeminjaman).toHaveBeenCalledWith(
        'acc-admin',
        dto,
      );
    });

    it('propagates 404 Peminjaman request not found', async () => {
      peminjamanService.acceptPeminjaman.mockRejectedValue(
        new NotFoundException('Peminjaman request not found'),
      );
      await expect(
        controller.acceptPeminjaman(adminReq, dto),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('propagates 500 Internal server error', async () => {
      peminjamanService.acceptPeminjaman.mockRejectedValue(
        new InternalServerErrorException('Internal server error'),
      );
      await expect(
        controller.acceptPeminjaman(adminReq, dto),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('POST /acceptpengembalian', () => {
    it('is restricted to authenticated admins', () => {
      const guards = Reflect.getMetadata(
        GUARDS_METADATA,
        // eslint-disable-next-line @typescript-eslint/unbound-method
        PeminjamanController.prototype.acceptPengembalian,
      ) as unknown[];
      expect(guards).toContain(AdminGuard);
      expect(guards).toHaveLength(2);
    });

    const dto = {
      temp_pengembalian_id: 7,
      status_buku: 'Baik',
    };

    it('admits pengembalian and returns "Pengembalian admission success"', async () => {
      await expect(
        controller.acceptPengembalian(adminReq, dto),
      ).resolves.toEqual({
        message: 'Pengembalian admission success',
      });
      expect(peminjamanService.acceptPengembalian).toHaveBeenCalledWith(
        'acc-admin',
        dto,
      );
    });

    it('propagates 404 Peminjaman not found', async () => {
      peminjamanService.acceptPengembalian.mockRejectedValue(
        new NotFoundException('Peminjaman not found'),
      );
      await expect(
        controller.acceptPengembalian(adminReq, dto),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('propagates 500 Internal server error', async () => {
      peminjamanService.acceptPengembalian.mockRejectedValue(
        new InternalServerErrorException('Internal server error'),
      );
      await expect(
        controller.acceptPengembalian(adminReq, dto),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });
});
