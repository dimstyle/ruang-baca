import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@ruangbaca/database';
import { AcceptPeminjamanDto } from './dto/accept-peminjaman.dto';
import { AcceptPengembalianDto } from './dto/accept-pengembalian.dto';
import { CreatePeminjamanDto } from './dto/create-peminjaman.dto';
import { CreatePengembalianDto } from './dto/create-pengembalian.dto';

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
export class PeminjamanService {
  private readonly logger = new Logger(PeminjamanService.name);

  constructor(private readonly prisma: PrismaService) {}

  async peminjaman(accountId: string, dto: CreatePeminjamanDto): Promise<void> {
    try {
      const userId = await this.resolveUserId(accountId);
      await this.prisma.$executeRawUnsafe(
        queries.insertTempPeminjaman,
        userId,
        dto.book_id,
        new Date(dto.tanggal_peminjaman),
      );
      this.logger.log(
        `Temp peminjaman created (book ${dto.book_id}) by user ${userId}`,
      );
    } catch (e) {
      throw this.unexpected('peminjaman', e);
    }
  }

  async pengembalian(
    accountId: string,
    dto: CreatePengembalianDto,
  ): Promise<void> {
    let peminjaman: { id: number } | undefined;
    try {
      [peminjaman] = await this.prisma.$queryRawUnsafe<Array<{ id: number }>>(
        queries.findPeminjamanById,
        dto.peminjaman_id,
      );
    } catch (e) {
      throw this.unexpected('pengembalian', e);
    }

    if (!peminjaman) {
      this.logger.warn(
        `Pengembalian rejected, peminjaman not found: ${dto.peminjaman_id}`,
      );
      throw new NotFoundException('Peminjaman not found');
    }

    try {
      await this.prisma.$executeRawUnsafe(
        queries.insertTempPengembalian,
        dto.peminjaman_id,
        new Date(dto.tanggal_dikembalikan),
      );
      this.logger.log(
        `Temp pengembalian created (peminjaman ${dto.peminjaman_id}) by account ${accountId}`,
      );
    } catch (e) {
      throw this.unexpected('pengembalian', e);
    }
  }

  async acceptPeminjaman(
    accountId: string,
    dto: AcceptPeminjamanDto,
  ): Promise<void> {
    let temp:
      | {
          id: number;
          user_id: string;
          book_id: number;
          tanggal_peminjaman: Date;
        }
      | undefined;
    let adminId: string;

    try {
      adminId = await this.resolveAdminId(accountId);
      [temp] = await this.prisma.$queryRawUnsafe(
        queries.findTempPeminjamanById,
        dto.temp_peminjaman_id,
      );
    } catch (e) {
      throw this.unexpected('acceptPeminjaman', e);
    }

    if (!temp) {
      this.logger.warn(
        `Accept peminjaman rejected, request not found: ${dto.temp_peminjaman_id}`,
      );
      throw new NotFoundException('Peminjaman request not found');
    }

    try {
      await this.prisma.$executeRawUnsafe(
        queries.insertPeminjaman,
        temp.user_id,
        adminId,
        temp.book_id,
        new Date(temp.tanggal_peminjaman),
        new Date(dto.tanggal_batas_peminjaman),
      );
      await this.prisma.$executeRawUnsafe(
        queries.deleteTempPeminjamanById,
        temp.id,
      );
      this.logger.log(
        `Peminjaman admitted from temp ${temp.id} by admin ${adminId}`,
      );
    } catch (e) {
      throw this.unexpected('acceptPeminjaman', e);
    }
  }

  async acceptPengembalian(
    accountId: string,
    dto: AcceptPengembalianDto,
  ): Promise<void> {
    let temp:
      | {
          id: number;
          peminjaman_id: number;
          tanggal_dikembalikan: Date;
        }
      | undefined;
    let adminId: string;

    try {
      adminId = await this.resolveAdminId(accountId);
      [temp] = await this.prisma.$queryRawUnsafe(
        queries.findTempPengembalianById,
        dto.temp_pengembalian_id,
      );
    } catch (e) {
      throw this.unexpected('acceptPengembalian', e);
    }

    if (!temp) {
      this.logger.warn(
        `Accept pengembalian rejected, temp pengembalian not found: ${dto.temp_pengembalian_id}`,
      );
      throw new NotFoundException('Peminjaman not found');
    }

    try {
      const [pengembalian] = await this.prisma.$queryRawUnsafe<
        Array<{ id: number | bigint }>
      >(
        queries.insertPengembalian,
        temp.peminjaman_id,
        new Date(temp.tanggal_dikembalikan),
        dto.status_buku,
      );
      if (dto.denda && dto.denda > 0 && pengembalian?.id !== undefined) {
        await this.prisma.$executeRawUnsafe(
          queries.insertDendaOnAccept,
          Number(pengembalian.id),
          dto.denda,
          dto.keterangan?.trim() || `Denda pengembalian (${dto.status_buku})`,
        );
      }
      await this.prisma.$executeRawUnsafe(
        queries.deleteTempPengembalianById,
        temp.id,
      );
      this.logger.log(
        `Pengembalian admitted from temp ${temp.id} by admin ${adminId}`,
      );
    } catch (e) {
      throw this.unexpected('acceptPengembalian', e);
    }
  }

  async listTempPeminjaman(accountId: string) {
    try {
      const records = await this.prisma.$queryRawUnsafe<
        Array<{
          temp_peminjaman_id: number;
          username: string;
          nama_lengkap: string;
          judul_buku: string;
          tanggal_peminjaman: Date;
        }>
      >(queries.findAllTempPeminjaman);
      this.logger.log(
        `Temp peminjaman listed (${records.length}) by admin ${accountId}`,
      );
      return records;
    } catch (e) {
      throw this.unexpected('listTempPeminjaman', e);
    }
  }

  async listTempPengembalian(accountId: string) {
    try {
      const records = await this.prisma.$queryRawUnsafe<
        Array<{
          temp_pengembalian_id: number;
          peminjaman_id: number;
          username: string;
          nama_lengkap: string;
          judul_buku: string;
          tanggal_batas_peminjaman: Date;
          tanggal_dikembalikan: Date;
        }>
      >(queries.findAllTempPengembalian);
      this.logger.log(
        `Temp pengembalian listed (${records.length}) by admin ${accountId}`,
      );
      return records;
    } catch (e) {
      throw this.unexpected('listTempPengembalian', e);
    }
  }

  async listPeminjaman(accountId: string) {
    type Row = {
      peminjaman_id: number | null;
      judul_buku: string;
      tanggal_peminjaman: Date;
      tanggal_batas_peminjaman: Date | null;
      status: string;
    };
    try {
      const userId = await this.resolveUserId(accountId);
      const pending = await this.prisma.$queryRawUnsafe<Row[]>(
        queries.findTempPeminjamanByUser,
        userId,
      );
      const loans = await this.prisma.$queryRawUnsafe<Row[]>(
        queries.findPeminjamanByUser,
        userId,
      );
      this.logger.log(
        `Peminjaman listed (${pending.length + loans.length}) for user ${userId}`,
      );
      return [...pending, ...loans];
    } catch (e) {
      throw this.unexpected('listPeminjaman', e);
    }
  }

  private async resolveUserId(accountOrUserId: string): Promise<string> {
    const [user] = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      queries.findUserByAccountId,
      accountOrUserId,
      accountOrUserId,
    );
    return user?.id ?? accountOrUserId;
  }

  private async resolveAdminId(accountOrAdminId: string): Promise<string> {
    const [admin] = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      queries.findAdminByAccountId,
      accountOrAdminId,
      accountOrAdminId,
    );
    return admin?.id ?? accountOrAdminId;
  }

  private unexpected(action: string, e: unknown) {
    this.logger.error(
      `Unexpected error during ${action}`,
      e instanceof Error ? e.stack : String(e),
    );
    return new InternalServerErrorException('Internal server error');
  }
}
