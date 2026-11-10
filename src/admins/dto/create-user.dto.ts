import { IsNotEmpty, IsString } from 'class-validator';

export class CreateUserDto {
  // account id the user profile is attached to (404 "account not found")
  @IsString()
  @IsNotEmpty()
  id_user: string;

  @IsString()
  @IsNotEmpty()
  nama_lengkap: string;

  @IsString()
  @IsNotEmpty()
  no_hp: string;

  @IsString()
  @IsNotEmpty()
  alamat: string;
}
