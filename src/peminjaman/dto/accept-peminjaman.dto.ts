import { IsDateString, IsInt, Min } from 'class-validator';

export class AcceptPeminjamanDto {
  @IsInt()
  @Min(1)
  temp_peminjaman_id!: number;

  @IsDateString()
  tanggal_batas_peminjaman!: string;
}
