import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @IsString()
  @IsNotEmpty()
  id_user: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nama_lengkap?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  no_hp?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  alamat?: string;
}
