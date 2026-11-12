import { IsInt, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreateDendaDto {
  @IsInt()
  id_pengembalian: number;

  @IsNumber()
  denda: number;

  @IsString()
  @IsNotEmpty()
  keterangan: string;
}
