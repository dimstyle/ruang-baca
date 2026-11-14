import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PrismaService } from '@ruangbaca/database';
import { CreateBookDto } from './dto/create-book.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

const sqlDir = join(__dirname, 'sql');
const queries = Object.fromEntries(
  readdirSync(sqlDir)
    .filter((f) => f.endsWith('.queries.sql'))
    .flatMap((f) =>
      readFileSync(join(sqlDir, f), 'utf8')
        .split(/^--\s*name:\s*/m)
        .slice(1)
        .map((b) => {
          const i = b.indexOf('\n');
          return [b.slice(0, i).trim(), b.slice(i + 1).trim()];
        }),
    ),
);

const isFkError = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError &&
  (e.code === 'P2003' || /foreign\s*key/i.test(e.message));

@Injectable()
export class BooksService {
  private readonly logger = new Logger(BooksService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createCategory(adminId: string, dto: CreateCategoryDto): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(
        queries.insertCategory,
        dto.nama_kategori,
        dto.jenis_buku,
      );
      this.logger.log(
        `Category created (${dto.nama_kategori} - ${dto.jenis_buku}) by admin ${adminId}`,
      );
    } catch (e) {
      throw this.unexpected('createCategory', e);
    }
  }

  async updateCategory(adminId: string, dto: UpdateCategoryDto): Promise<void> {
    let count: number;
    try {
      count = await this.prisma.$executeRawUnsafe(
        queries.updateCategoryById,
        dto.nama_kategori ?? null,
        dto.jenis_buku ?? null,
        dto.kategori_id,
      );
    } catch (e) {
      throw this.unexpected('updateCategory', e);
    }

    if (count === 0) {
      this.logger.warn(
        `Update category rejected, not found: ${dto.kategori_id}`,
      );
      throw new NotFoundException('Category not found');
    }

    this.logger.log(`Category updated: ${dto.kategori_id} by admin ${adminId}`);
  }

  async deleteCategory(adminId: string, kategori_id: number): Promise<void> {
    let count: number;
    try {
      count = await this.prisma.$executeRawUnsafe(
        queries.deleteCategoryById,
        kategori_id,
      );
    } catch (e) {
      if (isFkError(e)) {
        this.logger.warn(
          `Delete category rejected, has related books: ${kategori_id}`,
        );
        throw new ConflictException('category still has books records');
      }
      throw this.unexpected('deleteCategory', e);
    }

    if (count === 0) {
      this.logger.warn(`Delete category rejected, not found: ${kategori_id}`);
      throw new NotFoundException('Category not found');
    }

    this.logger.log(`Category deleted: ${kategori_id} by admin ${adminId}`);
  }

  async readListCategories() {
    let records: Array<{
      id: number;
      nama_kategori: string;
      jenis_buku: string;
    }>;
    try {
      records = await this.prisma.$queryRawUnsafe(queries.findAllCategories);
    } catch (e) {
      throw this.unexpected('readListCategories', e);
    }

    if (records.length === 0) {
      this.logger.warn('Read list categories rejected, no categories found');
      throw new NotFoundException('Category not found');
    }

    this.logger.log(`List categories fetched (${records.length} records)`);
    return records;
  }

  async createBook(adminId: string, dto: CreateBookDto): Promise<void> {
    let category: { id: number } | undefined;
    try {
      [category] = await this.prisma.$queryRawUnsafe<Array<{ id: number }>>(
        queries.findCategoryById,
        dto.kategori_id,
      );
    } catch (e) {
      throw this.unexpected('createBook', e);
    }

    if (!category) {
      this.logger.warn(
        `Create book rejected, category not found: ${dto.kategori_id}`,
      );
      throw new NotFoundException('Kategori not found');
    }

    try {
      await this.prisma.$executeRawUnsafe(
        queries.insertBook,
        dto.kategori_id,
        dto.judul,
        dto.penulis,
        dto.penerbit,
        dto.sinopsis,
        new Date(dto.tanggal_rilis),
        dto.stok,
      );
      this.logger.log(`Book created (${dto.judul}) by admin ${adminId}`);
    } catch (e) {
      if (isFkError(e)) {
        this.logger.warn(
          `Create book rejected, category not found: ${dto.kategori_id}`,
        );
        throw new NotFoundException('Kategori not found');
      }
      throw this.unexpected('createBook', e);
    }
  }

  async updateBook(adminId: string, dto: UpdateBookDto): Promise<void> {
    let count: number;
    try {
      count = await this.prisma.$executeRawUnsafe(
        queries.updateBookById,
        dto.kategori_id ?? null,
        dto.judul ?? null,
        dto.penulis ?? null,
        dto.penerbit ?? null,
        dto.sinopsis ?? null,
        dto.tanggal_rilis ? new Date(dto.tanggal_rilis) : null,
        dto.stok ?? null,
        dto.buku_id,
      );
    } catch (e) {
      throw this.unexpected('updateBook', e);
    }

    if (count === 0) {
      this.logger.warn(`Update book rejected, not found: ${dto.buku_id}`);
      throw new NotFoundException('Book not found');
    }

    this.logger.log(`Book updated: ${dto.buku_id} by admin ${adminId}`);
  }

  async getBook() {
    let records: Array<{
      id: number;
      kategori_id: number;
      nama_kategori: string;
      jenis_buku: string;
      judul_buku: string;
      penulis_buku: string;
      penerbit: string;
      sinopsis: string;
      tanggal_rilis: Date;
      stok: number;
    }>;
    try {
      records = await this.prisma.$queryRawUnsafe(queries.findAllBooks);
    } catch (e) {
      throw this.unexpected('getBook', e);
    }

    if (records.length === 0) {
      this.logger.warn('Get book rejected, no books found');
      throw new NotFoundException('Book not found');
    }

    this.logger.log(`Books fetched (${records.length} records)`);
    return records;
  }

  async deleteBook(adminId: string, buku_id: number): Promise<void> {
    let count: number;
    try {
      count = await this.prisma.$executeRawUnsafe(
        queries.deleteBookById,
        buku_id,
      );
    } catch (e) {
      throw this.unexpected('deleteBook', e);
    }

    if (count === 0) {
      this.logger.warn(`Delete book rejected, not found: ${buku_id}`);
      throw new NotFoundException('Book not found');
    }

    this.logger.log(`Book deleted: ${buku_id} by admin ${adminId}`);
  }

  private unexpected(action: string, e: unknown) {
    this.logger.error(
      `Unexpected error during ${action}`,
      e instanceof Error ? e.stack : String(e),
    );
    return new InternalServerErrorException('Internal server error');
  }
}
