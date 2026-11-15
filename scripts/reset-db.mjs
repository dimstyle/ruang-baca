#!/usr/bin/env node
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { resolveActiveDbFromEnv } from './create-admin.mjs';

const rootRequire = createRequire(resolve(process.cwd(), 'package.json'));

/**
 * Ordered from child tables to parent tables so foreign key constraints
 * (including ON DELETE RESTRICT) never block a full database reset.
 */
export const TABLES_IN_DELETE_ORDER = [
  'daftar_denda',
  'pengembalian',
  'temp_pengembalian',
  'peminjaman',
  'temp_peminjaman',
  'laporan',
  'books',
  'categories',
  'refresh_token',
  'users',
  'admins',
  'accounts',
];

export async function resetAllDatabaseTables(
  dbTarget = resolveActiveDbFromEnv(),
) {
  if (dbTarget.provider === 'sqlite') {
    const adapterEntry = rootRequire.resolve('@prisma/adapter-better-sqlite3', {
      paths: [resolve(process.cwd(), 'database')],
    });
    const adapterReq = createRequire(adapterEntry);
    const Database = adapterReq('better-sqlite3');
    const db = new Database(dbTarget.sqlitePath);
    try {
      db.pragma('foreign_keys = OFF');
      const tx = db.transaction(() => {
        for (const table of TABLES_IN_DELETE_ORDER) {
          const exists = db
            .prepare(
              `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
            )
            .get(table);
          if (exists) {
            db.prepare(`DELETE FROM "${table}"`).run();
          }
        }
        const seqExists = db
          .prepare(
            `SELECT name FROM sqlite_master WHERE type='table' AND name='sqlite_sequence'`,
          )
          .get();
        if (seqExists) {
          db.prepare(`DELETE FROM sqlite_sequence`).run();
        }
      });
      tx();
      db.pragma('foreign_keys = ON');
    } finally {
      db.close();
    }

    return {
      provider: 'sqlite',
      tablesCleared: TABLES_IN_DELETE_ORDER,
    };
  }

  const prismaEntry = rootRequire.resolve('prisma/config', {
    paths: [resolve(process.cwd(), 'database')],
  });
  const prismaReq = createRequire(prismaEntry);
  const postgresMod = prismaReq('postgres');
  const postgres =
    typeof postgresMod === 'function' ? postgresMod : postgresMod.default;
  const sql = postgres(dbTarget.url, { max: 1, onnotice: () => {} });

  try {
    const tableList = TABLES_IN_DELETE_ORDER.map((t) => `"${t}"`).join(', ');
    await sql.unsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
  } finally {
    await sql.end({ timeout: 5 });
  }

  return {
    provider: 'postgresql',
    tablesCleared: TABLES_IN_DELETE_ORDER,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const force =
    args.includes('--yes') || args.includes('-y') || args.includes('--force');
  const dbTarget = resolveActiveDbFromEnv();

  if (!force && input.isTTY) {
    const rl = createInterface({ input, output });
    try {
      const answer = (
        await rl.question(
          `[PERINGATAN] Seluruh data pada database (${dbTarget.provider.toUpperCase()}) akan dihapus bersih. Lanjutkan? (y/N): `,
        )
      )
        .trim()
        .toLowerCase();
      if (answer !== 'y' && answer !== 'yes') {
        console.log('Reset database dibatalkan.');
        return;
      }
    } finally {
      rl.close();
    }
  }

  const result = await resetAllDatabaseTables(dbTarget);
  console.log(
    `Berhasil me-reset seluruh data database (${result.provider.toUpperCase()})!`,
  );
  console.log(`- Tabel dibersihkan (${result.tablesCleared.length}): ${result.tablesCleared.join(', ')}`);
}

const isMain =
  process.argv[1] &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);

if (isMain) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
