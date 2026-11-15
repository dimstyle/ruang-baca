import { resolve } from 'node:path';
import { defineConfig } from 'prisma/config';
import { resolveDatabaseConfig } from './src/database-config';

function getDatasourceUrl(): string {
  try {
    const cfg = resolveDatabaseConfig(process.env, {
      cwd: resolve(__dirname, '..'),
    });
    return cfg.url;
  } catch {
    return process.env.DATABASE_URL ?? 'file:./database.sqlite';
  }
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    url: getDatasourceUrl(),
  },
});
