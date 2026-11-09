import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    // Development DB per specs/database-contracts.md: database/database.sqlite
    url: process.env.DATABASE_URL ?? 'file:./database.sqlite',
  },
});
