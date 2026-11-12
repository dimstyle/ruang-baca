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
import { CreateDendaDto } from './dto/create-denda.dto';
import { UpdateDendaDto } from './dto/update-denda.dto';
import { UpdateUserDto } from './dto/update-user.dto';

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
  (e.code === 'P2003' || e.message.includes('FOREIGNKEY'));

@Injectable()
export class AdminsService {
  private readonly logger = new Logger(AdminsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async updateUser(adminId: string, dto: UpdateUserDto): Promise<void> {
    let count: number;
    try {
      count = await this.prisma.$executeRawUnsafe(
        queries.updateUser,
        dto.nama_lengkap ?? null,
        dto.no_hp ?? null,
        dto.alamat ?? null,
        new Date(),
        dto.id_user,
      );
    } catch (e) {
      throw this.unexpected('updateUser', e);
    }
    if (count === 0) {
      this.logger.warn(`Update user rejected, not found: ${dto.id_user}`);
      throw new NotFoundException('User not found');
    }
    this.logger.log(`User updated: ${dto.id_user} by admin ${adminId}`);
  }

  async deleteUser(adminId: string, id_user: string): Promise<void> {
    const [user] = await this.prisma.$queryRawUnsafe<
      Array<{ id: string; account_id: string }>
    >(queries.findUserAccountById, id_user);
    if (!user) {
      this.logger.warn(`Delete user rejected, not found: ${id_user}`);
      throw new NotFoundException('User not found');
    }

    try {
      // users row goes with it via onDelete: Cascade
      await this.prisma.$executeRawUnsafe(
        queries.deleteAccountById,
        user.account_id,
      );
      this.logger.log(
        `User deleted: ${id_user} (account ${user.account_id}) by admin ${adminId}`,
      );
    } catch (e) {
      if (isFkError(e)) {
        this.logger.warn(`Delete user rejected, has related data: ${id_user}`);
        throw new ConflictException(
          'user still has peminjaman or denda records',
        );
      }
      throw this.unexpected('deleteUser', e);
    }
  }

  async getUser(adminId: string, id_user: string) {
    const [row] = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        account_id: string;
        nama_lengkap: string;
        no_hp: string;
        alamat: string;
        created_at: Date;
        updated_at: Date;
        username: string;
        email: string;
        role: string;
        account_created_at: Date;
      }>
    >(queries.findUserWithAccountById, id_user);
    if (!row) {
      this.logger.warn(`Get user rejected, not found: ${id_user}`);
      throw new NotFoundException('User not found');
    }
    this.logger.log(`User fetched: ${id_user} by admin ${adminId}`);
    return {
      id: row.id,
      account_id: row.account_id,
      nama_lengkap: row.nama_lengkap,
      no_hp: row.no_hp,
      alamat: row.alamat,
      created_at: row.created_at,
      updated_at: row.updated_at,
      account: {
        id: row.account_id,
        username: row.username,
        email: row.email,
        role: row.role,
        created_at: row.account_created_at,
      },
    };
  }

  async createDenda(adminId: string, dto: CreateDendaDto): Promise<void> {
    const [pengembalian] = await this.prisma.$queryRawUnsafe<
      Array<{ id: number }>
    >(queries.findPengembalianById, dto.id_pengembalian);
    if (!pengembalian) {
      this.logger.warn(
        `Create denda rejected, pengembalian not found: ${dto.id_pengembalian}`,
      );
      throw new NotFoundException('User not found');
    }

    try {
      const [record] = await this.prisma.$queryRawUnsafe<Array<{ id: number }>>(
        queries.insertDenda,
        dto.id_pengembalian,
        dto.denda,
        dto.keterangan,
      );
      this.logger.log(
        `Denda created: ${record.id} (pengembalian ${dto.id_pengembalian}) by admin ${adminId}`,
      );
    } catch (e) {
      throw this.unexpected('createDenda', e);
    }
  }

  async updateDenda(adminId: string, dto: UpdateDendaDto): Promise<void> {
    const [record] = await this.prisma.$queryRawUnsafe<
      Array<{ id: number; denda: number }>
    >(queries.findDendaById, dto.id_daftar_denda);
    if (!record) {
      this.logger.warn(
        `Update denda rejected, not found: ${dto.id_daftar_denda}`,
      );
      throw new NotFoundException('Denda not found');
    }

    const sisa = Number(record.denda) - dto.uang_masuk;
    try {
      if (sisa <= 0) {
        await this.prisma.$executeRawUnsafe(
          queries.deleteDendaById,
          dto.id_daftar_denda,
        );
        this.logger.log(
          `Denda deleted (paid off): ${dto.id_daftar_denda} by admin ${adminId}`,
        );
      } else {
        await this.prisma.$executeRawUnsafe(
          queries.updateDendaAmount,
          sisa,
          dto.id_daftar_denda,
        );
        this.logger.log(
          `Denda updated: ${dto.id_daftar_denda} (remaining ${sisa}) by admin ${adminId}`,
        );
      }
    } catch (e) {
      throw this.unexpected('updateDenda', e);
    }
  }

  async getDenda(adminId: string) {
    const records = await this.prisma.$queryRawUnsafe<
      Array<{
        id_denda: number;
        username: string;
        nama_lengkap: string;
        status_buku: string;
        denda: number;
        keterangan_buku: string;
        tanggal_dikembalikan: Date;
      }>
    >(queries.findAllDenda);
    if (records.length === 0) {
      this.logger.warn('Get denda rejected, no denda records found');
      throw new NotFoundException('denda not found');
    }

    this.logger.log(
      `Denda fetched (${records.length} records) by admin ${adminId}`,
    );
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
