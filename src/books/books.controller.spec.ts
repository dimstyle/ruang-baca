import {
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@ruangbaca/database';
import { AdminGuard } from '../auth/guards/admin.guard';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';

jest.mock('@ruangbaca/database', () => ({
  PrismaService: class {},
  Prisma: { PrismaClientKnownRequestError: class {} },
}));

describe('BooksController', () => {
  let controller: BooksController;
  const booksService = {
    createCategory: jest.fn(),
    updateCategory: jest.fn(),
    deleteCategory: jest.fn(),
    readListCategories: jest.fn(),
    createBook: jest.fn(),
    updateBook: jest.fn(),
    getBook: jest.fn(),
    deleteBook: jest.fn(),
  };
  const req = { user: { sub: 'acc-admin', email: 'a@x.id' } } as Parameters<
    BooksController['createCategory']
  >[0];

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BooksController],
      providers: [
        { provide: BooksService, useValue: booksService },
        { provide: PrismaService, useValue: {} }, // needed by AdminGuard
      ],
    }).compile();

    controller = module.get(BooksController);
  });

  describe('POST /createcategory', () => {
    it('is restricted to authenticated admins', () => {
      const guards = Reflect.getMetadata(
        GUARDS_METADATA,
        // eslint-disable-next-line @typescript-eslint/unbound-method
        BooksController.prototype.createCategory,
      ) as unknown[];
      expect(guards).toContain(AdminGuard);
      expect(guards).toHaveLength(2); // AuthGuard('jwt') runs first
    });

    const dto = {
      nama_kategori: 'Teknologi',
      jenis_buku: 'Non-Fiksi',
    };

    it('creates a category and returns "Categories created"', async () => {
      await expect(controller.createCategory(req, dto)).resolves.toEqual({
        message: 'Categories created',
      });
      expect(booksService.createCategory).toHaveBeenCalledWith(
        'acc-admin',
        dto,
      );
    });

    it('propagates 500 Internal server error', async () => {
      booksService.createCategory.mockRejectedValue(
        new InternalServerErrorException('Internal server error'),
      );
      await expect(controller.createCategory(req, dto)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('PUT /updatecategory', () => {
    it('is restricted to authenticated admins', () => {
      const guards = Reflect.getMetadata(
        GUARDS_METADATA,
        // eslint-disable-next-line @typescript-eslint/unbound-method
        BooksController.prototype.updateCategory,
      ) as unknown[];
      expect(guards).toContain(AdminGuard);
      expect(guards).toHaveLength(2);
    });

    const dto = {
      kategori_id: 1,
      nama_kategori: 'Sains & Teknologi',
      jenis_buku: 'Ilmiah',
    };

    it('updates the category and returns "Category updated"', async () => {
      await expect(controller.updateCategory(req, dto)).resolves.toEqual({
        message: 'Category updated',
      });
      expect(booksService.updateCategory).toHaveBeenCalledWith(
        'acc-admin',
        dto,
      );
    });

    it('propagates 404 Category not found', async () => {
      booksService.updateCategory.mockRejectedValue(
        new NotFoundException('Category not found'),
      );
      await expect(controller.updateCategory(req, dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('propagates 500 Internal server error', async () => {
      booksService.updateCategory.mockRejectedValue(
        new InternalServerErrorException('Internal server error'),
      );
      await expect(controller.updateCategory(req, dto)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('DELETE /deletecategory', () => {
    it('is restricted to authenticated admins', () => {
      const guards = Reflect.getMetadata(
        GUARDS_METADATA,
        // eslint-disable-next-line @typescript-eslint/unbound-method
        BooksController.prototype.deleteCategory,
      ) as unknown[];
      expect(guards).toContain(AdminGuard);
      expect(guards).toHaveLength(2);
    });

    const dto = { kategori_id: 1 };

    it('deletes the category and returns "Category deleted"', async () => {
      await expect(controller.deleteCategory(req, dto)).resolves.toEqual({
        message: 'Category deleted',
      });
      expect(booksService.deleteCategory).toHaveBeenCalledWith('acc-admin', 1);
    });

    it('propagates 404 Category not found', async () => {
      booksService.deleteCategory.mockRejectedValue(
        new NotFoundException('Category not found'),
      );
      await expect(controller.deleteCategory(req, dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('propagates 409 when category still has books records', async () => {
      booksService.deleteCategory.mockRejectedValue(
        new ConflictException('category still has books records'),
      );
      await expect(controller.deleteCategory(req, dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('propagates 500 Internal server error', async () => {
      booksService.deleteCategory.mockRejectedValue(
        new InternalServerErrorException('Internal server error'),
      );
      await expect(controller.deleteCategory(req, dto)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('GET /readlistcategories', () => {
    it('is publicly accessible without guards', () => {
      const guards = Reflect.getMetadata(
        GUARDS_METADATA,
        // eslint-disable-next-line @typescript-eslint/unbound-method
        BooksController.prototype.readListCategories,
      ) as unknown[] | undefined;
      expect(guards).toBeUndefined();
    });

    const categories = [
      { nama_kategori: 'Teknologi', jenis_buku: 'Non-Fiksi' },
      { nama_kategori: 'Novel', jenis_buku: 'Fiksi' },
    ];

    it('returns the category list with "Categories found"', async () => {
      booksService.readListCategories.mockResolvedValue(categories);
      await expect(controller.readListCategories()).resolves.toEqual({
        message: 'Categories found',
        data: categories,
      });
      expect(booksService.readListCategories).toHaveBeenCalledTimes(1);
    });

    it('propagates 404 Category not found when list is empty', async () => {
      booksService.readListCategories.mockRejectedValue(
        new NotFoundException('Category not found'),
      );
      await expect(controller.readListCategories()).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('POST /createbook', () => {
    it('is restricted to authenticated admins', () => {
      const guards = Reflect.getMetadata(
        GUARDS_METADATA,
        // eslint-disable-next-line @typescript-eslint/unbound-method
        BooksController.prototype.createBook,
      ) as unknown[];
      expect(guards).toContain(AdminGuard);
      expect(guards).toHaveLength(2);
    });

    const dto = {
      kategori_id: 1,
      judul: 'Clean Code',
      penulis: 'Robert C. Martin',
      penerbit: 'Prentice Hall',
      sinopsis: 'Panduan menulis kode yang bersih dan mudah dipelihara.',
      tanggal_rilis: '2008-08-01T00:00:00.000Z',
      stok: 10,
    };

    it('creates a book and returns "Book created"', async () => {
      await expect(controller.createBook(req, dto)).resolves.toEqual({
        message: 'Book created',
      });
      expect(booksService.createBook).toHaveBeenCalledWith('acc-admin', dto);
    });

    it('propagates 404 Kategori not found', async () => {
      booksService.createBook.mockRejectedValue(
        new NotFoundException('Kategori not found'),
      );
      await expect(controller.createBook(req, dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('propagates 500 Internal server error', async () => {
      booksService.createBook.mockRejectedValue(
        new InternalServerErrorException('Internal server error'),
      );
      await expect(controller.createBook(req, dto)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('PUT /updatebook', () => {
    it('is restricted to authenticated admins', () => {
      const guards = Reflect.getMetadata(
        GUARDS_METADATA,
        // eslint-disable-next-line @typescript-eslint/unbound-method
        BooksController.prototype.updateBook,
      ) as unknown[];
      expect(guards).toContain(AdminGuard);
      expect(guards).toHaveLength(2);
    });

    const dto = {
      buku_id: 1,
      judul: 'Clean Code (Revised)',
      stok: 15,
    };

    it('updates the book and returns "Books updated"', async () => {
      await expect(controller.updateBook(req, dto)).resolves.toEqual({
        message: 'Books updated',
      });
      expect(booksService.updateBook).toHaveBeenCalledWith('acc-admin', dto);
    });

    it('propagates 404 Book not found', async () => {
      booksService.updateBook.mockRejectedValue(
        new NotFoundException('Book not found'),
      );
      await expect(controller.updateBook(req, dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('propagates 500 Internal server error', async () => {
      booksService.updateBook.mockRejectedValue(
        new InternalServerErrorException('Internal server error'),
      );
      await expect(controller.updateBook(req, dto)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('GET /getbook', () => {
    it('is publicly accessible without guards', () => {
      const guards = Reflect.getMetadata(
        GUARDS_METADATA,
        // eslint-disable-next-line @typescript-eslint/unbound-method
        BooksController.prototype.getBook,
      ) as unknown[] | undefined;
      expect(guards).toBeUndefined();
    });

    const books = [
      {
        nama_kategori: 'Teknologi',
        jenis_buku: 'Non-Fiksi',
        judul_buku: 'Clean Code',
        penulis_buku: 'Robert C. Martin',
        sinopsis: 'Panduan menulis kode yang bersih dan mudah dipelihara.',
        tanggal_rilis: new Date('2008-08-01T00:00:00.000Z'),
        stok: 10,
      },
    ];

    it('returns the book list with "Book found"', async () => {
      booksService.getBook.mockResolvedValue(books);
      await expect(controller.getBook()).resolves.toEqual({
        message: 'Book found',
        data: books,
      });
      expect(booksService.getBook).toHaveBeenCalledTimes(1);
    });

    it('propagates 404 Book not found when list is empty', async () => {
      booksService.getBook.mockRejectedValue(
        new NotFoundException('Book not found'),
      );
      await expect(controller.getBook()).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('propagates 500 Internal server error', async () => {
      booksService.getBook.mockRejectedValue(
        new InternalServerErrorException('Internal server error'),
      );
      await expect(controller.getBook()).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('DELETE /deletebook', () => {
    it('is restricted to authenticated admins', () => {
      const guards = Reflect.getMetadata(
        GUARDS_METADATA,
        // eslint-disable-next-line @typescript-eslint/unbound-method
        BooksController.prototype.deleteBook,
      ) as unknown[];
      expect(guards).toContain(AdminGuard);
      expect(guards).toHaveLength(2);
    });

    const dto = { buku_id: 1 };

    it('deletes the book and returns "Book deleted"', async () => {
      await expect(controller.deleteBook(req, dto)).resolves.toEqual({
        message: 'Book deleted',
      });
      expect(booksService.deleteBook).toHaveBeenCalledWith('acc-admin', 1);
    });

    it('propagates 404 Book not found', async () => {
      booksService.deleteBook.mockRejectedValue(
        new NotFoundException('Book not found'),
      );
      await expect(controller.deleteBook(req, dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('propagates 500 Internal server error', async () => {
      booksService.deleteBook.mockRejectedValue(
        new InternalServerErrorException('Internal server error'),
      );
      await expect(controller.deleteBook(req, dto)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });
});
