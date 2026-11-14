import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class AcceptPengembalianDto {
  @IsInt()
  @Min(1)
  temp_pengembalian_id!: number;

  @IsString()
  @IsNotEmpty()
  status_buku!: string;
}
