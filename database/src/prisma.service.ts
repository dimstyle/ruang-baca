import { Buffer } from 'node:buffer';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { DatabaseConfig, resolveDatabaseConfig } from './database-config';
import { PrismaClient } from './generated/prisma/client';
import { PrismaPostgresAdapterFactory } from './postgres-adapter';

function buildClientOptions(dbConfig: DatabaseConfig): Record<string, unknown> {
  if (dbConfig.provider === 'sqlite') {
    return {
      adapter: new PrismaBetterSqlite3({ url: dbConfig.url }),
    };
  }

  return {
    adapter: new PrismaPostgresAdapterFactory({ url: dbConfig.url }),
    __internal: {
      configOverride: (cfg: Record<string, unknown>) => ({
        ...cfg,
        activeProvider: 'postgresql',
        inlineSchema:
          typeof cfg.inlineSchema === 'string'
            ? cfg.inlineSchema.replace(
                'provider = "sqlite"',
                'provider = "postgresql"',
              )
            : cfg.inlineSchema,
        compilerWasm: {
          getRuntime: () =>
            Promise.resolve(
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              require('@prisma/client/runtime/query_compiler_fast_bg.postgresql.js') as unknown,
            ),
          getQueryCompilerWasmModule: () => {
            const { wasm } =
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              require('@prisma/client/runtime/query_compiler_fast_bg.postgresql.wasm-base64.js') as {
                wasm: string;
              };
            return Promise.resolve(
              new WebAssembly.Module(Buffer.from(wasm, 'base64')),
            );
          },
          importName: './query_compiler_fast_bg.js',
        },
      }),
    },
  };
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private static readonly logger = new Logger(PrismaService.name);
  readonly activeProvider: 'sqlite' | 'postgresql';

  constructor() {
    let dbConfig: DatabaseConfig;
    try {
      dbConfig = resolveDatabaseConfig();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      PrismaService.logger.error(msg);
      throw err;
    }

    super(
      buildClientOptions(dbConfig) as unknown as ConstructorParameters<
        typeof PrismaClient
      >[0],
    );
    this.activeProvider = dbConfig.provider;
    PrismaService.logger.log(
      `Database engine initialized: ${dbConfig.provider}`,
    );
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
