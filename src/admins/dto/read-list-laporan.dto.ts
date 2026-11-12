import { IsDateString, IsOptional } from 'class-validator';

export class ReadListLaporanDto {
  @IsOptional()
  @IsDateString()
  tanggal_awal_laporan?: string;

  @IsOptional()
  @IsDateString()
  tanggal_akhir_laporan?: string;
}
