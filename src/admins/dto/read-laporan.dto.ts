import { IsInt } from 'class-validator';

export class ReadLaporanDto {
  @IsInt()
  laporan_id: number;
}
