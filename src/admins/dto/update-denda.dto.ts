import { IsInt, IsNumber } from 'class-validator';

export class UpdateDendaDto {
  @IsInt()
  id_daftar_denda: number;

  @IsNumber()
  uang_masuk: number;
}
