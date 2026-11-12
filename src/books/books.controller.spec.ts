import {
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
});
