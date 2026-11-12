import { IsNotEmpty, IsString } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  nama_kategori!: string;

  @IsString()
  @IsNotEmpty()
  jenis_buku!: string;
}
