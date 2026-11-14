import {
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
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
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
    getUser: jest.fn(),
    listUser: jest.fn(),
    createDenda: jest.fn(),
    updateDenda: jest.fn(),
    getDenda: jest.fn(),
    createLaporan: jest.fn(),
    readLaporan: jest.fn(),
    readListLaporan: jest.fn(),
  };
  const req = { user: { sub: 'acc-admin', email: 'a@x.id' } } as Parameters<
    AdminsController['updateUser']
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

  describe('POST /createdenda', () => {
    const dto = {
      id_pengembalian: 1,
      denda: 15000,
      keterangan: 'Buku rusak',
    };

    it('creates the denda record as the calling admin', async () => {
      await expect(controller.createDenda(req, dto)).resolves.toEqual({
        message: 'Denda created',
      });
      expect(adminsService.createDenda).toHaveBeenCalledWith('acc-admin', dto);
    });

    it('propagates 404 when pengembalian/user is not found', async () => {
      adminsService.createDenda.mockRejectedValue(new NotFoundException());
      await expect(controller.createDenda(req, dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('PUT /updatedenda', () => {
    const dto = {
      id_daftar_denda: 1,
      uang_masuk: 5000,
    };

    it('updates the denda record', async () => {
      await expect(controller.updateDenda(req, dto)).resolves.toEqual({
        message: 'Denda updated',
      });
      expect(adminsService.updateDenda).toHaveBeenCalledWith('acc-admin', dto);
    });

    it('propagates 404 Denda not found', async () => {
      adminsService.updateDenda.mockRejectedValue(new NotFoundException());
      await expect(controller.updateDenda(req, dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('GET /getdenda', () => {
    it('returns the list of denda records', async () => {
      const list = [
        {
          id_denda: 1,
          username: 'budi',
          nama_lengkap: 'Budi',
          status_buku: 'Rusak',
          denda: 15000,
          keterangan_buku: 'Buku rusak',
          tanggal_dikembalikan: new Date('2026-11-12T00:00:00.000Z'),
        },
      ];
      adminsService.getDenda.mockResolvedValue(list);
      await expect(controller.getDenda(req)).resolves.toEqual({
        message: 'Denda found',
        data: list,
      });
      expect(adminsService.getDenda).toHaveBeenCalledWith('acc-admin');
    });

    it('propagates 404 denda not found when list is empty', async () => {
      adminsService.getDenda.mockRejectedValue(
        new NotFoundException('denda not found'),
      );
      await expect(controller.getDenda(req)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('POST /createlaporan', () => {
    const dto = {
      keterangan: 'Laporan bulanan November',
      tanggal_awal_peminjaman: '2026-11-01T00:00:00.000Z',
      tanggal_akhir_peminjaman: '2026-11-30T23:59:59.000Z',
      tanggal_awal_pengembalian: '2026-11-01T00:00:00.000Z',
      tanggal_akhir_pengembalian: '2026-11-30T23:59:59.000Z',
      tanggal_pembuatan_laporan: '2026-11-30T23:59:59.000Z',
    };

    it('creates a laporan record for the calling admin', async () => {
      await expect(controller.createLaporan(req, dto)).resolves.toEqual({
        message: 'Laporan created',
      });
      expect(adminsService.createLaporan).toHaveBeenCalledWith(
        'acc-admin',
        dto,
      );
    });

    it('propagates 500 Internal server error on unexpected failure', async () => {
      adminsService.createLaporan.mockRejectedValue(
        new InternalServerErrorException('Internal server error'),
      );
      await expect(controller.createLaporan(req, dto)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('GET /readlaporan', () => {
    const dto = { laporan_id: 1 };

    it('returns the detailed laporan data', async () => {
      const detail = {
        email_admin: 'a@x.id',
        username_admin: 'admin1',
        nama_lengkap_admin: 'Admin Satu',
        keterangan: 'Laporan bulanan November',
        total_denda: 15000,
        peminjaman: [
          {
            email_user: 'u@x.id',
            username_user: 'budi',
            nama_lengkap_user: 'Budi',
            judul_buku: 'Clean Code',
            penerbit: 'Prentice Hall',
            tanggal_rilis: new Date('2008-08-01T00:00:00.000Z'),
            tanggal_peminjaman: new Date('2026-11-05T00:00:00.000Z'),
          },
        ],
        pengembalian: [
          {
            email_user: 'u@x.id',
            username_user: 'budi',
            nama_lengkap_user: 'Budi',
            judul_buku: 'Clean Code',
            penerbit: 'Prentice Hall',
            tanggal_rilis: new Date('2008-08-01T00:00:00.000Z'),
            status_buku: 'Rusak',
            denda: 15000,
            tanggal_pengembalian: new Date('2026-11-10T00:00:00.000Z'),
          },
        ],
      };
      adminsService.readLaporan.mockResolvedValue(detail);
      await expect(controller.readLaporan(req, dto)).resolves.toEqual({
        message: 'Laporan found',
        data: detail,
      });
      expect(adminsService.readLaporan).toHaveBeenCalledWith('acc-admin', 1);
    });

    it('propagates 404 laporan not found', async () => {
      adminsService.readLaporan.mockRejectedValue(
        new NotFoundException('laporan not found'),
      );
      await expect(controller.readLaporan(req, dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('GET /readlistlaporan', () => {
    it('returns the list of laporan records', async () => {
      const list = [
        {
          laporan_id: 1,
          tanggal_pembuatan_laporan: new Date('2026-11-30T23:59:59.000Z'),
        },
      ];
      const dto = {
        tanggal_awal_laporan: '2026-11-01T00:00:00.000Z',
        tanggal_akhir_laporan: '2026-11-30T23:59:59.000Z',
      };
      adminsService.readListLaporan.mockResolvedValue(list);
      await expect(controller.readListLaporan(req, dto)).resolves.toEqual({
        message: 'Laporan found',
        data: list,
      });
      expect(adminsService.readListLaporan).toHaveBeenCalledWith(
        'acc-admin',
        dto,
      );
    });

    it('propagates 422 Unprocessable Content when date range is incomplete', async () => {
      adminsService.readListLaporan.mockRejectedValue(
        new UnprocessableEntityException('Unprocessable Content'),
      );
      await expect(
        controller.readListLaporan(req, {
          tanggal_awal_laporan: '2026-11-01T00:00:00.000Z',
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('propagates 404 laporan not found when list is empty', async () => {
      adminsService.readListLaporan.mockRejectedValue(
        new NotFoundException('laporan not found'),
      );
      await expect(controller.readListLaporan(req, {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('GET /listuser', () => {
    it('returns the list of registered users', async () => {
      const users = [
        {
          id_user: 'u1',
          username: 'budi',
          email: 'budi@x.id',
          nama_lengkap: 'Budi',
          no_hp: '0812',
          alamat: 'Jl. A',
          created_at: new Date(),
        },
      ];
      adminsService.listUser.mockResolvedValue(users);
      await expect(controller.listUser(req)).resolves.toEqual({
        message: 'Users found',
        data: users,
      });
      expect(adminsService.listUser).toHaveBeenCalledWith('acc-admin');
    });
  });
});
