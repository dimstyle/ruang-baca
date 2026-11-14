import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { AdminGuard } from '../auth/guards/admin.guard';
import type { AccessTokenPayload } from '../auth/strategies/jwt.strategy';
import { AcceptPeminjamanDto } from './dto/accept-peminjaman.dto';
import { AcceptPengembalianDto } from './dto/accept-pengembalian.dto';
import { CreatePeminjamanDto } from './dto/create-peminjaman.dto';
import { CreatePengembalianDto } from './dto/create-pengembalian.dto';
import { PeminjamanService } from './peminjaman.service';

type AuthedRequest = Request & { user: AccessTokenPayload };

@Controller('peminjaman')
export class PeminjamanController {
  constructor(private readonly peminjamanService: PeminjamanService) {}

  @Post('peminjaman')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  async peminjaman(
    @Req() req: AuthedRequest,
    @Body() dto: CreatePeminjamanDto,
  ) {
    await this.peminjamanService.peminjaman(req.user.sub, dto);
    return { message: 'Peminjaman success, wait for admin admission' };
  }

  @Post('pengembalian')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  async pengembalian(
    @Req() req: AuthedRequest,
    @Body() dto: CreatePengembalianDto,
  ) {
    await this.peminjamanService.pengembalian(req.user.sub, dto);
    return { message: 'Pengembalian success, wait for admin admission' };
  }

  @Post('acceptpeminjaman')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  async acceptPeminjaman(
    @Req() req: AuthedRequest,
    @Body() dto: AcceptPeminjamanDto,
  ) {
    await this.peminjamanService.acceptPeminjaman(req.user.sub, dto);
    return { message: 'Peminjaman admission success' };
  }

  @Post('acceptpengembalian')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  async acceptPengembalian(
    @Req() req: AuthedRequest,
    @Body() dto: AcceptPengembalianDto,
  ) {
    await this.peminjamanService.acceptPengembalian(req.user.sub, dto);
    return { message: 'Pengembalian admission success' };
  }

  @Get('listtemppeminjaman')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  async listTempPeminjaman(@Req() req: AuthedRequest) {
    const data = await this.peminjamanService.listTempPeminjaman(req.user.sub);
    return { message: 'Peminjaman requests found', data };
  }

  @Get('listtemppengembalian')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  async listTempPengembalian(@Req() req: AuthedRequest) {
    const data = await this.peminjamanService.listTempPengembalian(
      req.user.sub,
    );
    return { message: 'Pengembalian requests found', data };
  }

  @Get('listpeminjaman')
  @UseGuards(AuthGuard('jwt'))
  async listPeminjaman(@Req() req: AuthedRequest) {
    const data = await this.peminjamanService.listPeminjaman(req.user.sub);
    return { message: 'Peminjaman found', data };
  }
}
