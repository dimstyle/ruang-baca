import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PrismaService } from '@ruangbaca/database';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const isPrismaError = (e: unknown, code: string) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === code;

@Injectable()
export class AdminsService {
  private readonly logger = new Logger(AdminsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createUser(adminId: string, dto: CreateUserDto): Promise<void> {
    const { id_user, ...data } = dto;
    const account = await this.prisma.account.findUnique({
      where: { id: id_user },
    });
    if (!account) {
      this.logger.warn(`Create user rejected, account not found: ${id_user}`);
      throw new NotFoundException('account not found');
    }

    try {
      const user = await this.prisma.user.create({
        data: { account_id: id_user, ...data },
      });
      this.logger.log(
        `User created: ${user.id} (account ${id_user}) by admin ${adminId}`,
      );
    } catch (e) {
      if (isPrismaError(e, 'P2002')) {
        this.logger.warn(`Create user rejected, already exists: ${id_user}`);
        throw new ConflictException('user data already exists');
      }
      throw this.unexpected('createUser', e);
    }
  }

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

  private unexpected(action: string, e: unknown) {
    this.logger.error(
      `Unexpected error during ${action}`,
      e instanceof Error ? e.stack : String(e),
    );
    return new InternalServerErrorException('Internal server error');
  }
}
