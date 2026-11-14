import { IsDateString, IsInt, Min } from 'class-validator';

export class CreatePengembalianDto {
  @IsInt()
  @Min(1)
  peminjaman_id!: number;

  @IsDateString()
  tanggal_dikembalikan!: string;
}
