import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

export class CreateLaporanDto {
  @IsString()
  @IsNotEmpty()
  keterangan: string;

  @IsDateString()
  tanggal_awal_peminjaman: string;

  @IsDateString()
  tanggal_akhir_peminjaman: string;

  @IsDateString()
  tanggal_awal_pengembalian: string;

  @IsDateString()
  tanggal_akhir_pengembalian: string;

  @IsDateString()
  tanggal_pembuatan_laporan: string;
}
