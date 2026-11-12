import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@ruangbaca/database';
import { CreateCategoryDto } from './dto/create-category.dto';
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
      throw this.unexpected('deleteCategory', e);
    }

    if (count === 0) {
      this.logger.warn(`Delete category rejected, not found: ${kategori_id}`);
      throw new NotFoundException('Category not found');
    }

    this.logger.log(`Category deleted: ${kategori_id} by admin ${adminId}`);
  }

  async readListCategories() {
    let records: Array<{ nama_kategori: string; jenis_buku: string }>;
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

  private unexpected(action: string, e: unknown) {
    this.logger.error(
      `Unexpected error during ${action}`,
      e instanceof Error ? e.stack : String(e),
    );
    return new InternalServerErrorException('Internal server error');
  }
}
