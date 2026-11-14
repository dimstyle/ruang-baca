import { join } from 'node:path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module';

process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'test-jwt-secret';

describe('AppController (e2e)', () => {
  let app: NestExpressApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    app.setBaseViewsDir(join(__dirname, '..', 'views'));
    app.setViewEngine('ejs');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/ (GET) redirects to /app/katalog', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(302)
      .expect('Location', '/app/katalog');
  });

  it('/login (GET) renders login page', () => {
    return request(app.getHttpServer())
      .get('/login')
      .expect(200)
      .expect(/Ruang Baca/);
  });
});
