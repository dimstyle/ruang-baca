import { IsInt, Min } from 'class-validator';

export class DeleteCategoryDto {
  @IsInt()
  @Min(1)
  kategori_id!: number;
}
