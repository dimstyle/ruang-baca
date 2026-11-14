import { Module } from '@nestjs/common';
import { PrismaModule } from '@ruangbaca/database';
import { AdminsModule } from './admins/admins.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BooksModule } from './books/books.module';
import { PeminjamanModule } from './peminjaman/peminjaman.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AdminsModule,
    BooksModule,
    PeminjamanModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
