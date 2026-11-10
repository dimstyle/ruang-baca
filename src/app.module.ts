import { Module } from '@nestjs/common';
import { PrismaModule } from '@ruangbaca/database';
import { AdminsModule } from './admins/admins.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule, AdminsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
