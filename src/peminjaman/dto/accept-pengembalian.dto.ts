import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class AcceptPengembalianDto {
  @IsInt()
  @Min(1)
  temp_pengembalian_id!: number;

  @IsString()
  @IsNotEmpty()
  status_buku!: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  denda?: number;

  @IsOptional()
  @IsString()
  keterangan?: string;
}
