import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
  Req,
  Res,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AdminsService } from '../admins/admins.service';
import { BooksService } from '../books/books.service';
import { PeminjamanService } from '../peminjaman/peminjaman.service';
import { helpers } from './view-helpers';
import { Session, ViewsService } from './views.service';

// Services throw 404 for empty lists (per api-spec); a page just shows empty-state.
const orEmpty = async <T>(p: Promise<T[]>): Promise<T[]> => {
  try {
    return await p;
  } catch (e) {
    if (e instanceof NotFoundException) return [];
    throw e;
  }
};

type PageOpts = { view: string; title: string; admin?: boolean };

@Controller()
export class ViewsController {
  constructor(
    private readonly views: ViewsService,
    private readonly books: BooksService,
    private readonly admins: AdminsService,
    private readonly peminjaman: PeminjamanService,
  ) {}

  @Get()
  root(@Res() res: Response) {
    res.redirect('/app/katalog');
  }

  @Get('buku')
  async buku(@Req() req: Request, @Res() res: Response) {
    const session = await this.views.session(req, res);
    const [books, categories] = await Promise.all([
      orEmpty(this.books.getBook()),
      orEmpty(this.books.readListCategories()),
    ]);
    res.render('buku', {
      ...helpers,
      title: 'Daftar Buku',
      books,
      categories,
      session,
      isAdmin: session?.role === 'admin',
      path: '/buku',
    });
  }

  @Get('daftar-buku')
  daftarBuku(@Res() res: Response) {
    res.redirect('/buku');
  }

  @Get('login')
  async login(@Req() req: Request, @Res() res: Response) {
    if (await this.views.session(req, res)) return res.redirect('/app/katalog');
    res.render('login', { ...helpers, title: 'Masuk' });
  }

  @Get('app/katalog')
  katalog(@Req() req: Request, @Res() res: Response) {
    return this.page(
      req,
      res,
      { view: 'katalog', title: 'Katalog Buku' },
      async () => ({
        books: await orEmpty(this.books.getBook()),
        categories: await orEmpty(this.books.readListCategories()),
      }),
    );
  }

  @Get('app/kategori')
  kategori(@Req() req: Request, @Res() res: Response) {
    return this.page(
      req,
      res,
      { view: 'kategori', title: 'Kategori' },
      async () => {
        const [categories, books] = await Promise.all([
          orEmpty(this.books.readListCategories()),
          orEmpty(this.books.getBook()),
        ]);
        const counts: Record<number, number> = {};
        for (const b of books)
          counts[b.kategori_id] = (counts[b.kategori_id] ?? 0) + 1;
        return { categories, counts };
      },
    );
  }

  @Get('app/peminjaman-saya')
  peminjamanSaya(@Req() req: Request, @Res() res: Response) {
    return this.page(
      req,
      res,
      { view: 'peminjaman-saya', title: 'Peminjaman Saya' },
      async (s) => ({ loans: await this.peminjaman.listPeminjaman(s.id) }),
    );
  }

  @Get('app/admin/permintaan-peminjaman')
  permintaanPeminjaman(@Req() req: Request, @Res() res: Response) {
    return this.page(
      req,
      res,
      {
        view: 'permintaan-peminjaman',
        title: 'Permintaan Peminjaman',
        admin: true,
      },
      async (s) => ({
        requests: await this.peminjaman.listTempPeminjaman(s.id),
      }),
    );
  }

  @Get('app/admin/permintaan-pengembalian')
  permintaanPengembalian(@Req() req: Request, @Res() res: Response) {
    return this.page(
      req,
      res,
      {
        view: 'permintaan-pengembalian',
        title: 'Permintaan Pengembalian',
        admin: true,
      },
      async (s) => ({
        requests: await this.peminjaman.listTempPengembalian(s.id),
      }),
    );
  }

  @Get('app/admin/anggota')
  anggota(@Req() req: Request, @Res() res: Response, @Query('id') id?: string) {
    return this.page(
      req,
      res,
      { view: 'anggota', title: 'Anggota', admin: true },
      async (s) => ({
        users: await this.admins.listUser(s.id),
        selected: id
          ? await this.admins.getUser(s.id, id).catch((e: unknown) => {
              if (e instanceof NotFoundException) return null;
              throw e;
            })
          : null,
      }),
    );
  }

  @Get('app/admin/denda')
  denda(@Req() req: Request, @Res() res: Response) {
    return this.page(
      req,
      res,
      { view: 'denda', title: 'Denda', admin: true },
      async (s) => ({
        fines: await orEmpty(this.admins.getDenda(s.id)),
      }),
    );
  }

  @Get('app/admin/laporan')
  laporan(
    @Req() req: Request,
    @Res() res: Response,
    @Query('awal') awal?: string,
    @Query('akhir') akhir?: string,
  ) {
    return this.page(
      req,
      res,
      { view: 'laporan', title: 'Laporan', admin: true },
      async (s) => {
        const filter = { awal: awal ?? '', akhir: akhir ?? '' };
        try {
          const reports = await orEmpty(
            this.admins.readListLaporan(s.id, {
              tanggal_awal_laporan: awal || undefined,
              tanggal_akhir_laporan: akhir || undefined,
            }),
          );
          return { reports, filter, error: null };
        } catch (e) {
          if (!(e instanceof UnprocessableEntityException)) throw e;
          return {
            reports: [],
            filter,
            error: 'Tanggal awal dan akhir wajib diisi keduanya',
          };
        }
      },
    );
  }

  @Get('app/admin/laporan/:id')
  laporanDetail(
    @Req() req: Request,
    @Res() res: Response,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.page(
      req,
      res,
      { view: 'laporan-detail', title: 'Detail Laporan', admin: true },
      async (s) => ({
        report: await this.admins.readLaporan(s.id, id).catch((e: unknown) => {
          if (e instanceof NotFoundException) return null;
          throw e;
        }),
      }),
    );
  }

  private async page(
    req: Request,
    res: Response,
    opts: PageOpts,
    load: (s: Session) => Promise<object>,
  ) {
    const session = await this.views.session(req, res);
    if (!session) return res.redirect('/login');
    const isAdmin = session.role === 'admin';
    if (opts.admin && !isAdmin) return res.redirect('/app/katalog');

    const [data, badges] = await Promise.all([
      load(session),
      isAdmin ? this.views.badges() : Promise.resolve(null),
    ]);
    res.render(opts.view, {
      ...helpers,
      ...data,
      title: opts.title,
      session,
      isAdmin,
      badges,
      path: req.path,
    });
  }
}
