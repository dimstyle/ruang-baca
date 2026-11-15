#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { isAbsolute, resolve } from 'node:path';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const rootRequire = createRequire(resolve(process.cwd(), 'package.json'));
const bcrypt = rootRequire('bcrypt');

const SALT_ROUNDS = 10;
export const MIN_PASSWORD_LENGTH = 8;

export function parseAdminCliArgs(argv) {
  const opts = {
    username: '',
    email: '',
    password: '',
    nama_lengkap: '',
    no_hp: '',
    alamat: '',
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    if ((arg === '--username' || arg === '-u') && next) {
      opts.username = argv[++i];
    } else if ((arg === '--email' || arg === '-e') && next) {
      opts.email = argv[++i];
    } else if ((arg === '--password' || arg === '-p') && next) {
      opts.password = argv[++i];
    } else if (
      (arg === '--nama-lengkap' || arg === '--name' || arg === '-n') &&
      next
    ) {
      opts.nama_lengkap = argv[++i];
    } else if ((arg === '--no-hp' || arg === '--phone') && next) {
      opts.no_hp = argv[++i];
    } else if ((arg === '--alamat' || arg === '--address') && next) {
      opts.alamat = argv[++i];
    }
  }

  return opts;
}

export function loadEnvMap(envPath = resolve(process.cwd(), '.env')) {
  const result = {};
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      result[key] = val;
    }
  }
  return { ...result, ...process.env };
}

export function resolveActiveDbFromEnv(env = loadEnvMap()) {
  const sqlitePath = (env.SQLITE_PATH ?? '').trim();
  if (sqlitePath) {
    const raw = sqlitePath.replace(/^file:/, '');
    const absPath = isAbsolute(raw) ? raw : resolve(process.cwd(), raw);
    return { provider: 'sqlite', sqlitePath: absPath };
  }

  const pgUser = (
    env.POSTGRESS_USERNAME ??
    env.POSTGRES_USERNAME ??
    env.POSTGRES_USER ??
    ''
  ).trim();
  const pgPassword = (
    env.POSTGRESS_PASSWORD ??
    env.POSTGRES_PASSWORD ??
    ''
  ).trim();
  const pgDatabase = (
    env.POSTGRESS_DATABASE ??
    env.POSTGRES_DATABASE ??
    env.POSTGRES_DB ??
    ''
  ).trim();
  const pgHost =
    (env.POSTGRESS_HOST ?? env.POSTGRES_HOST ?? '').trim() || 'localhost';
  const pgPort =
    (env.POSTGRESS_PORT ?? env.POSTGRES_PORT ?? '').trim() || '5432';
  const explicitUrl = (env.DATABASE_URL ?? '').trim();

  if (
    (pgUser && pgPassword && pgDatabase) ||
    /^postgres(ql)?:\/\//i.test(explicitUrl)
  ) {
    const url = /^postgres(ql)?:\/\//i.test(explicitUrl)
      ? explicitUrl
      : `postgresql://${encodeURIComponent(pgUser)}:${encodeURIComponent(pgPassword)}@${pgHost}:${pgPort}/${encodeURIComponent(pgDatabase)}`;
    return { provider: 'postgresql', url };
  }

  throw new Error(
    '[Ruang Baca Database] Konfigurasi database tidak ditemukan di .env! ' +
      'Silakan gunakan salah satu: (1) isi SQLITE_PATH untuk menggunakan SQLite, atau ' +
      '(2) kosongkan SQLITE_PATH dan isi POSTGRESS_USERNAME, POSTGRESS_PASSWORD, serta POSTGRESS_DATABASE untuk menggunakan PostgreSQL.',
  );
}

export async function createAdminRecord(
  data,
  dbTarget = resolveActiveDbFromEnv(),
) {
  const username = (data.username ?? '').trim();
  const email = (data.email ?? '').trim();
  const password = data.password ?? '';
  const nama_lengkap = (data.nama_lengkap ?? '').trim();
  const no_hp = (data.no_hp ?? '').trim();
  const alamat = (data.alamat ?? '').trim();

  if (!username || !email || !password || !nama_lengkap || !no_hp || !alamat) {
    throw new Error(
      'Seluruh field (username, email, password, nama_lengkap, no_hp, alamat) wajib diisi.',
    );
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `Password minimal harus ${MIN_PASSWORD_LENGTH} karakter (saat ini ${password.length} karakter).`,
    );
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  const accountId = randomUUID();
  const adminId = randomUUID();
  const nowIso = new Date().toISOString();

  if (dbTarget.provider === 'sqlite') {
    const adapterEntry = rootRequire.resolve('@prisma/adapter-better-sqlite3', {
      paths: [resolve(process.cwd(), 'database')],
    });
    const adapterReq = createRequire(adapterEntry);
    const Database = adapterReq('better-sqlite3');
    const db = new Database(dbTarget.sqlitePath);
    try {
      const tx = db.transaction(() => {
        db.prepare(
          `INSERT INTO accounts (id, username, email, password, role, created_at)
           VALUES (?, ?, ?, ?, 'admin', ?)`,
        ).run(accountId, username, email, hashedPassword, nowIso);

        db.prepare(
          `INSERT INTO admins (id, account_id, nama_lengkap, no_hp, alamat, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ).run(adminId, accountId, nama_lengkap, no_hp, alamat, nowIso, nowIso);
      });
      tx();
    } finally {
      db.close();
    }

    return { provider: 'sqlite', accountId, adminId, username, email };
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
    await sql.begin(async (tx) => {
      await tx.unsafe(
        `INSERT INTO accounts (id, username, email, password, role, created_at)
         VALUES ($1, $2, $3, $4, 'admin', CURRENT_TIMESTAMP)`,
        [accountId, username, email, hashedPassword],
      );
      await tx.unsafe(
        `INSERT INTO admins (id, account_id, nama_lengkap, no_hp, alamat, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [adminId, accountId, nama_lengkap, no_hp, alamat],
      );
    });
  } finally {
    await sql.end({ timeout: 5 });
  }

  return { provider: 'postgresql', accountId, adminId, username, email };
}

async function main() {
  const dbTarget = resolveActiveDbFromEnv();
  const opts = parseAdminCliArgs(process.argv.slice(2));

  const needsInteractive =
    !opts.username ||
    !opts.email ||
    !opts.password ||
    !opts.nama_lengkap ||
    !opts.no_hp ||
    !opts.alamat;

  if (needsInteractive) {
    const rl = createInterface({ input, output });
    try {
      console.log(
        `=== Buat Akun Admin Ruang Baca (Engine: ${dbTarget.provider.toUpperCase()}) ===`,
      );
      if (!opts.username) {
        opts.username = (await rl.question('Username Admin      : ')).trim();
      }
      if (!opts.email) {
        opts.email = (await rl.question('Email Admin         : ')).trim();
      }
      while (!opts.password || opts.password.length < MIN_PASSWORD_LENGTH) {
        if (opts.password && opts.password.length < MIN_PASSWORD_LENGTH) {
          console.error(
            `[!] Password terlalu pendek (${opts.password.length} karakter). Minimal ${MIN_PASSWORD_LENGTH} karakter!`,
          );
        }
        opts.password = (
          await rl.question(
            `Password Admin (min ${MIN_PASSWORD_LENGTH} karakter): `,
          )
        ).trim();
      }
      if (!opts.nama_lengkap) {
        opts.nama_lengkap = (
          await rl.question('Nama Lengkap Admin  : ')
        ).trim();
      }
      if (!opts.no_hp) {
        opts.no_hp = (await rl.question('Nomor HP Admin      : ')).trim();
      }
      if (!opts.alamat) {
        opts.alamat = (await rl.question('Alamat Admin        : ')).trim();
      }
    } finally {
      rl.close();
    }
  }

  const created = await createAdminRecord(opts, dbTarget);
  console.log('\nAkun Admin berhasil ditambahkan langsung ke database!');
  console.log(`- Engine     : ${created.provider}`);
  console.log(`- Account ID : ${created.accountId}`);
  console.log(`- Admin ID   : ${created.adminId}`);
  console.log(`- Username   : ${created.username}`);
  console.log(`- Email      : ${created.email}`);
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
