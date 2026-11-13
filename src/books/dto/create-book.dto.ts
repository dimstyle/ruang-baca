import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
} from 'class-validator';

export class CreateBookDto {
  @IsInt()
  @Min(1)
  kategori_id!: number;

  @IsString()
  @IsNotEmpty()
  judul!: string;

  @IsString()
  @IsNotEmpty()
  penulis!: string;

  @IsString()
  @IsNotEmpty()
  penerbit!: string;

  @IsString()
  @IsNotEmpty()
  sinopsis!: string;

  @IsDateString()
  tanggal_rilis!: string;

  @IsInt()
  @Min(0)
  stok!: number;
}
