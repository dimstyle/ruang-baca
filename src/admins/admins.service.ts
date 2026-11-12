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

const isPrismaError = (e: unknown, code: string) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === code;

@Injectable()
export class AdminsService {
  private readonly logger = new Logger(AdminsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async updateUser(adminId: string, dto: UpdateUserDto): Promise<void> {
    const { id_user, ...data } = dto;
    try {
      // schema uses @default(now()) not @updatedAt, so set it by hand
      await this.prisma.user.update({
        where: { id: id_user },
        data: { ...data, updated_at: new Date() },
      });
      this.logger.log(`User updated: ${id_user} by admin ${adminId}`);
    } catch (e) {
      if (isPrismaError(e, 'P2025')) {
        this.logger.warn(`Update user rejected, not found: ${id_user}`);
        throw new NotFoundException('User not found');
      }
      throw this.unexpected('updateUser', e);
    }
  }

  async deleteUser(adminId: string, id_user: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: id_user } });
    if (!user) {
      this.logger.warn(`Delete user rejected, not found: ${id_user}`);
      throw new NotFoundException('User not found');
    }

    try {
      // users row goes with it via onDelete: Cascade
      await this.prisma.account.delete({ where: { id: user.account_id } });
      this.logger.log(
        `User deleted: ${id_user} (account ${user.account_id}) by admin ${adminId}`,
      );
    } catch (e) {
      if (isPrismaError(e, 'P2003')) {
        this.logger.warn(`Delete user rejected, has related data: ${id_user}`);
        throw new ConflictException(
          'user still has peminjaman or denda records',
        );
      }
      throw this.unexpected('deleteUser', e);
    }
  }

  async getUser(adminId: string, id_user: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: id_user },
      include: {
        account: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
            created_at: true,
          },
        },
      },
    });
    if (!user) {
      this.logger.warn(`Get user rejected, not found: ${id_user}`);
      throw new NotFoundException('User not found');
    }
    this.logger.log(`User fetched: ${id_user} by admin ${adminId}`);
    return user;
  }

  async createDenda(adminId: string, dto: CreateDendaDto): Promise<void> {
    const pengembalian = await this.prisma.pengembalian.findUnique({
      where: { id: dto.id_pengembalian },
    });
    if (!pengembalian) {
      this.logger.warn(
        `Create denda rejected, pengembalian not found: ${dto.id_pengembalian}`,
      );
      throw new NotFoundException('User not found');
    }

    try {
      const record = await this.prisma.daftarDenda.create({
        data: {
          pengembalian_id: dto.id_pengembalian,
          denda: dto.denda,
          keterangan: dto.keterangan,
        },
      });
      this.logger.log(
        `Denda created: ${record.id} (pengembalian ${dto.id_pengembalian}) by admin ${adminId}`,
      );
    } catch (e) {
      throw this.unexpected('createDenda', e);
    }
  }

  async updateDenda(adminId: string, dto: UpdateDendaDto): Promise<void> {
    const record = await this.prisma.daftarDenda.findUnique({
      where: { id: dto.id_daftar_denda },
    });
    if (!record) {
      this.logger.warn(
        `Update denda rejected, not found: ${dto.id_daftar_denda}`,
      );
      throw new NotFoundException('Denda not found');
    }

    const sisa = record.denda - dto.uang_masuk;
    try {
      if (sisa <= 0) {
        await this.prisma.daftarDenda.delete({
          where: { id: dto.id_daftar_denda },
        });
        this.logger.log(
          `Denda deleted (paid off): ${dto.id_daftar_denda} by admin ${adminId}`,
        );
      } else {
        await this.prisma.daftarDenda.update({
          where: { id: dto.id_daftar_denda },
          data: { denda: sisa },
        });
        this.logger.log(
          `Denda updated: ${dto.id_daftar_denda} (remaining ${sisa}) by admin ${adminId}`,
        );
      }
    } catch (e) {
      throw this.unexpected('updateDenda', e);
    }
  }

  async getDenda(adminId: string) {
    const records = await this.prisma.daftarDenda.findMany({
      include: {
        pengembalian: {
          include: {
            peminjaman: {
              include: {
                user: {
                  include: {
                    account: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (records.length === 0) {
      this.logger.warn('Get denda rejected, no denda records found');
      throw new NotFoundException('denda not found');
    }

    this.logger.log(
      `Denda fetched (${records.length} records) by admin ${adminId}`,
    );
    return records.map((r) => ({
      id_denda: r.id,
      username: r.pengembalian.peminjaman.user.account.username,
      nama_lengkap: r.pengembalian.peminjaman.user.nama_lengkap,
      status_buku: r.pengembalian.status_buku,
      denda: r.denda,
      keterangan_buku: r.keterangan,
      tanggal_dikembalikan: r.pengembalian.tanggal_dikembalikan,
    }));
  }

  private unexpected(action: string, e: unknown) {
    this.logger.error(
      `Unexpected error during ${action}`,
      e instanceof Error ? e.stack : String(e),
    );
    return new InternalServerErrorException('Internal server error');
  }
}
