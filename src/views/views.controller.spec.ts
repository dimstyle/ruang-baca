import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request, Response } from 'express';
import { AdminsService } from '../admins/admins.service';
import { BooksService } from '../books/books.service';
import { PeminjamanService } from '../peminjaman/peminjaman.service';
import { ViewsController } from './views.controller';
import { ViewsService } from './views.service';

jest.mock('@ruangbaca/database', () => ({
  PrismaService: class {},
  Prisma: { PrismaClientKnownRequestError: class {} },
}));

describe('ViewsController', () => {
  let controller: ViewsController;
  const viewsService = {
    session: jest.fn(),
    badges: jest.fn(),
  };
  const booksService = { getBook: jest.fn(), readListCategories: jest.fn() };
  const adminsService = {
    listUser: jest.fn(),
    getUser: jest.fn(),
    getDenda: jest.fn(),
    readListLaporan: jest.fn(),
    readLaporan: jest.fn(),
  };
  const peminjamanService = {
    listPeminjaman: jest.fn(),
    listTempPeminjaman: jest.fn(),
    listTempPengembalian: jest.fn(),
  };

  const mockRes = () => {
    const redirect = jest.fn();
    const render = jest.fn();
    const res = { redirect, render } as unknown as Response;
    return { res, redirect, render };
  };
  const req = { path: '/app/katalog', cookies: {} } as unknown as Request;

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ViewsController],
      providers: [
        { provide: ViewsService, useValue: viewsService },
        { provide: BooksService, useValue: booksService },
        { provide: AdminsService, useValue: adminsService },
        { provide: PeminjamanService, useValue: peminjamanService },
      ],
    }).compile();
    controller = module.get(ViewsController);
  });

  it('redirects root / to /app/katalog', () => {
    const { res, redirect } = mockRes();
    controller.root(res);
    expect(redirect).toHaveBeenCalledWith('/app/katalog');
  });

  it('renders public buku page for unauthenticated (non-login) user', async () => {
    const { res, render } = mockRes();
    viewsService.session.mockResolvedValue(null);
    booksService.getBook.mockResolvedValue([{ id: 1, judul_buku: 'Buku A' }]);
    booksService.readListCategories.mockResolvedValue([
      { id: 1, nama_kategori: 'Fiksi' },
    ]);

    await controller.buku(req, res);
    expect(render).toHaveBeenCalledWith(
      'buku',
      expect.objectContaining({
        title: 'Daftar Buku',
        books: [{ id: 1, judul_buku: 'Buku A' }],
        categories: [{ id: 1, nama_kategori: 'Fiksi' }],
        session: null,
        isAdmin: false,
        path: '/buku',
      }),
    );
  });

  it('renders public buku page with empty arrays when books/categories throw 404', async () => {
    const { res, render } = mockRes();
    viewsService.session.mockResolvedValue(null);
    booksService.getBook.mockRejectedValue(new NotFoundException());
    booksService.readListCategories.mockRejectedValue(new NotFoundException());

    await controller.buku(req, res);
    expect(render).toHaveBeenCalledWith(
      'buku',
      expect.objectContaining({
        title: 'Daftar Buku',
        books: [],
        categories: [],
        session: null,
        isAdmin: false,
      }),
    );
  });

  it('redirects /daftar-buku to /buku', () => {
    const { res, redirect } = mockRes();
    controller.daftarBuku(res);
    expect(redirect).toHaveBeenCalledWith('/buku');
  });

  it('redirects unauthenticated requests on /app/katalog to /login', async () => {
    const { res, redirect } = mockRes();
    viewsService.session.mockResolvedValue(null);
    await controller.katalog(req, res);
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('redirects non-admin users away from /app/admin/* to /app/katalog', async () => {
    const { res, redirect } = mockRes();
    viewsService.session.mockResolvedValue({
      id: 'u1',
      username: 'budi',
      email: 'budi@x.id',
      role: 'user',
      nama_lengkap: 'Budi',
    });
    await controller.anggota(req, res);
    expect(redirect).toHaveBeenCalledWith('/app/katalog');
  });

  it('renders katalog with empty arrays when books/categories throw 404', async () => {
    const { res, render } = mockRes();
    viewsService.session.mockResolvedValue({
      id: 'a1',
      username: 'admin',
      email: 'a@x.id',
      role: 'admin',
      nama_lengkap: 'Admin',
    });
    viewsService.badges.mockResolvedValue({ peminjaman: 2, pengembalian: 1 });
    booksService.getBook.mockRejectedValue(new NotFoundException());
    booksService.readListCategories.mockRejectedValue(new NotFoundException());

    await controller.katalog(req, res);
    expect(render).toHaveBeenCalledWith(
      'katalog',
      expect.objectContaining({
        books: [],
        categories: [],
        isAdmin: true,
        badges: { peminjaman: 2, pengembalian: 1 },
      }),
    );
  });
});
