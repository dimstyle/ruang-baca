import { IsDateString, IsInt, Min } from 'class-validator';

export class CreatePeminjamanDto {
  @IsInt()
  @Min(1)
  book_id!: number;

  @IsDateString()
  tanggal_peminjaman!: string;
}
