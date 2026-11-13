import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { AdminGuard } from '../auth/guards/admin.guard';
import type { AccessTokenPayload } from '../auth/strategies/jwt.strategy';
import { BooksService } from './books.service';
import { CreateBookDto } from './dto/create-book.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { DeleteBookDto } from './dto/delete-book.dto';
import { DeleteCategoryDto } from './dto/delete-category.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

type AuthedRequest = Request & { user: AccessTokenPayload };

@Controller('books')
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @Post('createcategory')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  async createCategory(
    @Req() req: AuthedRequest,
    @Body() dto: CreateCategoryDto,
  ) {
    await this.booksService.createCategory(req.user.sub, dto);
    return { message: 'Categories created' };
  }

  @Put('updatecategory')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  async updateCategory(
    @Req() req: AuthedRequest,
    @Body() dto: UpdateCategoryDto,
  ) {
    await this.booksService.updateCategory(req.user.sub, dto);
    return { message: 'Category updated' };
  }

  @Delete('deletecategory')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  async deleteCategory(
    @Req() req: AuthedRequest,
    @Body() dto: DeleteCategoryDto,
  ) {
    await this.booksService.deleteCategory(req.user.sub, dto.kategori_id);
    return { message: 'Category deleted' };
  }

  @Get('readlistcategories')
  async readListCategories() {
    const data = await this.booksService.readListCategories();
    return { message: 'Categories found', data };
  }

  @Post('createbook')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  async createBook(@Req() req: AuthedRequest, @Body() dto: CreateBookDto) {
    await this.booksService.createBook(req.user.sub, dto);
    return { message: 'Book created' };
  }

  @Put('updatebook')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  async updateBook(@Req() req: AuthedRequest, @Body() dto: UpdateBookDto) {
    await this.booksService.updateBook(req.user.sub, dto);
    return { message: 'Books updated' };
  }

  @Get('getbook')
  async getBook() {
    const data = await this.booksService.getBook();
    return { message: 'Book found', data };
  }

  @Delete('deletebook')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  async deleteBook(@Req() req: AuthedRequest, @Body() dto: DeleteBookDto) {
    await this.booksService.deleteBook(req.user.sub, dto.buku_id);
    return { message: 'Book deleted' };
  }
}
