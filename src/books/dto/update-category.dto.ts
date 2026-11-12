import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class UpdateCategoryDto {
  @IsInt()
  @Min(1)
  kategori_id!: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nama_kategori?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  jenis_buku?: string;
}
