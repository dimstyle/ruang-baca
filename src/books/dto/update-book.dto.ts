import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateBookDto {
  @IsInt()
  @Min(1)
  buku_id!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  kategori_id?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  judul?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  penulis?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  sinopsis?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  penerbit?: string;

  @IsOptional()
  @IsDateString()
  tanggal_rilis?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  stok?: number;
}
