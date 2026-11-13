import { IsInt, Min } from 'class-validator';

export class DeleteBookDto {
  @IsInt()
  @Min(1)
  buku_id!: number;
}
