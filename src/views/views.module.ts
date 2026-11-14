import { Module } from '@nestjs/common';
import { AdminsModule } from '../admins/admins.module';
import { AuthModule } from '../auth/auth.module';
import { BooksModule } from '../books/books.module';
import { PeminjamanModule } from '../peminjaman/peminjaman.module';
import { ViewsController } from './views.controller';
import { ViewsService } from './views.service';

@Module({
  imports: [AuthModule, AdminsModule, BooksModule, PeminjamanModule],
  controllers: [ViewsController],
  providers: [ViewsService],
})
export class ViewsModule {}
