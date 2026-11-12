import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { AdminGuard } from '../auth/guards/admin.guard';
import type { AccessTokenPayload } from '../auth/strategies/jwt.strategy';
import { AdminsService } from './admins.service';
import { CreateDendaDto } from './dto/create-denda.dto';
import { UpdateDendaDto } from './dto/update-denda.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserIdDto } from './dto/user-id.dto';

type AuthedRequest = Request & { user: AccessTokenPayload };

@Controller('admins')
@UseGuards(AuthGuard('jwt'), AdminGuard)
export class AdminsController {
  constructor(private readonly adminsService: AdminsService) {}

  @Put('updateuser')
  async updateUser(@Req() req: AuthedRequest, @Body() dto: UpdateUserDto) {
    await this.adminsService.updateUser(req.user.sub, dto);
    return { message: 'data has updated' };
  }

  @Delete('deleteuser')
  async deleteUser(@Req() req: AuthedRequest, @Body() dto: UserIdDto) {
    await this.adminsService.deleteUser(req.user.sub, dto.id_user);
    return { message: 'data has deleted' };
  }

  // spec puts id_user in the body of a GET; browsers' fetch cannot send that
  @Get('getuser')
  async getUser(@Req() req: AuthedRequest, @Body() dto: UserIdDto) {
    const data = await this.adminsService.getUser(req.user.sub, dto.id_user);
    return { message: 'User found', data };
  }

  @Post('createdenda')
  async createDenda(@Req() req: AuthedRequest, @Body() dto: CreateDendaDto) {
    await this.adminsService.createDenda(req.user.sub, dto);
    return { message: 'Denda created' };
  }

  @Put('updatedenda')
  async updateDenda(@Req() req: AuthedRequest, @Body() dto: UpdateDendaDto) {
    await this.adminsService.updateDenda(req.user.sub, dto);
    return { message: 'Denda updated' };
  }

  @Get('getdenda')
  async getDenda(@Req() req: AuthedRequest) {
    const data = await this.adminsService.getDenda(req.user.sub);
    return { message: 'Denda found', data };
  }
}
