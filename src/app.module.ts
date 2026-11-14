import { Module } from '@nestjs/common';
import { PrismaModule } from '@ruangbaca/database';
import { AdminsModule } from './admins/admins.module';
import { AuthModule } from './auth/auth.module';
import { BooksModule } from './books/books.module';
import { PeminjamanModule } from './peminjaman/peminjaman.module';
import { ViewsModule } from './views/views.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AdminsModule,
    BooksModule,
    PeminjamanModule,
    ViewsModule,
  ],
})
export class AppModule {}
