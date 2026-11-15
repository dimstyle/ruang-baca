import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  MISSING_DB_CONFIG_MESSAGE,
  PrismaPostgresAdapterFactory,
  convertSqlitePlaceholdersToPg,
  resolveDatabaseConfig,
} from '@ruangbaca/database';
import * as bcrypt from 'bcrypt';

describe('Environment Generator, Dual Database System & Admin CLI', () => {
  describe('pnpm env:generate (scripts/generate-env.mjs)', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = mkdtempSync(join(tmpdir(), 'ruangbaca-env-'));
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    it('generates random SHA-256 hashed secrets/passwords and sets POSTGRESS_USERNAME from input', () => {
      const outPath = join(tempDir, '.env.generated');
      const scriptPath = resolve(process.cwd(), 'scripts', 'generate-env.mjs');

      execFileSync(
        process.execPath,
        [scriptPath, '--username', 'dimas_admin', '--output', outPath],
        { cwd: process.cwd() },
      );

      const generated = readFileSync(outPath, 'utf8');
      expect(generated).toMatch(/^PORT=3000$/m);
      expect(generated).toMatch(/^JWT_SECRET_KEY=[a-f0-9]{64}$/m);
      expect(generated).toMatch(/^SQLITE_PATH=database\/database\.sqlite$/m);
      expect(generated).toMatch(/^(#\s*)?POSTGRESS_HOST=localhost$/m);
      expect(generated).toMatch(/^(#\s*)?POSTGRESS_PORT=5432$/m);
      expect(generated).toMatch(/^(#\s*)?POSTGRESS_PASSWORD=[a-f0-9]{64}$/m);
      expect(generated).toMatch(/^(#\s*)?POSTGRESS_USERNAME=dimas_admin$/m);
      expect(generated).toMatch(/^(#\s*)?POSTGRESS_DATABASE=perpustakaan$/m);

      const jwtMatch = generated.match(/^JWT_SECRET_KEY=([a-f0-9]{64})$/m);
      const pgPassMatch = generated.match(
        /^(?:#\s*)?POSTGRESS_PASSWORD=([a-f0-9]{64})$/m,
      );
      expect(jwtMatch?.[1]).not.toEqual(pgPassMatch?.[1]);
    });
  });

  describe('resolveDatabaseConfig (SQLite vs PostgreSQL selection)', () => {
    it('selects SQLite when SQLITE_PATH is present in .env (even if POSTGRESS_* is also present)', () => {
      const cfg = resolveDatabaseConfig(
        {
          SQLITE_PATH: 'database/database.sqlite',
          POSTGRESS_USERNAME: 'dims',
          POSTGRESS_PASSWORD: 'hashedpassword',
          POSTGRESS_DATABASE: 'perpustakaan',
        },
        { loadDotEnv: false, cwd: '/workspace/ruang-baca' },
      );

      expect(cfg.provider).toBe('sqlite');
      if (cfg.provider === 'sqlite') {
        expect(cfg.sqlitePath).toBe(
          '/workspace/ruang-baca/database/database.sqlite',
        );
        expect(cfg.url).toBe(
          'file:/workspace/ruang-baca/database/database.sqlite',
        );
      }
    });

    it('selects PostgreSQL when SQLITE_PATH is empty and POSTGRESS_* variables are provided', () => {
      const cfg = resolveDatabaseConfig(
        {
          SQLITE_PATH: '',
          POSTGRESS_HOST: 'db.internal',
          POSTGRESS_PORT: '5433',
          POSTGRESS_USERNAME: 'dims',
          POSTGRESS_PASSWORD: 'secret_hash_value',
          POSTGRESS_DATABASE: 'perpustakaan',
        },
        { loadDotEnv: false },
      );

      expect(cfg.provider).toBe('postgresql');
      if (cfg.provider === 'postgresql') {
        expect(cfg.url).toBe(
          'postgresql://dims:secret_hash_value@db.internal:5433/perpustakaan',
        );
        expect(cfg.postgres).toEqual({
          host: 'db.internal',
          port: 5433,
          username: 'dims',
          password: 'secret_hash_value',
          database: 'perpustakaan',
        });
      }
    });

    it('defaults POSTGRESS_HOST to localhost and POSTGRESS_PORT to 5432 when omitted', () => {
      const cfg = resolveDatabaseConfig(
        {
          POSTGRESS_USERNAME: 'postgres',
          POSTGRESS_PASSWORD: 'abc',
          POSTGRESS_DATABASE: 'perpustakaan',
        },
        { loadDotEnv: false },
      );

      expect(cfg.provider).toBe('postgresql');
      if (cfg.provider === 'postgresql') {
        expect(cfg.url).toBe(
          'postgresql://postgres:abc@localhost:5432/perpustakaan',
        );
      }
    });

    it('throws a clear developer message when neither SQLITE_PATH nor PostgreSQL is configured', () => {
      expect(() =>
        resolveDatabaseConfig(
          {
            PORT: '3000',
            JWT_SECRET_KEY: 'abc',
            SQLITE_PATH: '',
            POSTGRESS_USERNAME: '',
            POSTGRESS_PASSWORD: '',
          },
          { loadDotEnv: false },
        ),
      ).toThrow(MISSING_DB_CONFIG_MESSAGE);
    });
  });

  describe('convertSqlitePlaceholdersToPg & PrismaPostgresAdapterFactory', () => {
    it('converts unquoted ? placeholders to $1, $2, ... while preserving quoted strings and comments', () => {
      const sql = `-- comment with ? inside
        SELECT id, 'question?mark' AS label, "col?name"
        FROM accounts /* block ? comment */
        WHERE email = ? AND role = ? LIMIT 1;`;

      const converted = convertSqlitePlaceholdersToPg(sql);
      expect(converted).toContain('-- comment with ? inside');
      expect(converted).toContain("'question?mark'");
      expect(converted).toContain('"col?name"');
      expect(converted).toContain('/* block ? comment */');
      expect(converted).toContain('WHERE email = $1 AND role = $2 LIMIT 1;');
    });

    it('executes queryRaw and executeRaw via PrismaPostgresAdapterFactory with converted placeholders', async () => {
      const calls: Array<{ query: string; args?: unknown[] }> = [];
      const mockClient = {
        unsafe: (query: string, args?: unknown[]) => {
          calls.push({ query, args });
          const promise = Promise.resolve({ count: 1 }) as Promise<{
            count?: number;
          }> & {
            values: () => Promise<
              Array<Array<unknown>> & {
                columns?: Array<{ name: string; type: number }>;
              }
            >;
          };
          promise.values = () => {
            const rows = [['acc-1', 'admin']] as Array<Array<unknown>> & {
              columns?: Array<{ name: string; type: number }>;
            };
            rows.columns = [
              { name: 'id', type: 25 },
              { name: 'role', type: 25 },
            ];
            return Promise.resolve(rows);
          };
          return promise;
        },
      };

      const factory = new PrismaPostgresAdapterFactory(
        { url: 'postgresql://u:p@localhost:5432/db' },
        mockClient,
      );
      const adapter = await factory.connect();

      const res = await adapter.queryRaw({
        sql: 'SELECT id, role FROM accounts WHERE id = ?',
        args: ['acc-1'],
        argTypes: [{ scalarType: 'string', arity: 'scalar' }],
      });

      expect(calls[0]).toEqual({
        query: 'SELECT id, role FROM accounts WHERE id = $1',
        args: ['acc-1'],
      });
      expect(res.columnNames).toEqual(['id', 'role']);
      expect(res.rows).toEqual([['acc-1', 'admin']]);

      const count = await adapter.executeRaw({
        sql: 'DELETE FROM refresh_token WHERE account_id = ? AND token = ?',
        args: ['acc-1', 'tok-1'],
        argTypes: [
          { scalarType: 'string', arity: 'scalar' },
          { scalarType: 'string', arity: 'scalar' },
        ],
      });
      expect(count).toBe(1);
      expect(calls[1]).toEqual({
        query: 'DELETE FROM refresh_token WHERE account_id = $1 AND token = $2',
        args: ['acc-1', 'tok-1'],
      });
    });
  });

  describe('pnpm admin:create (scripts/create-admin.mjs)', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = mkdtempSync(join(tmpdir(), 'ruangbaca-admin-cli-'));
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    it('inserts admin account and profile directly into SQLite database with bcrypt password', async () => {
      const dbPath = join(tempDir, 'test-admin.sqlite');
      const rootReq = createRequire(resolve(process.cwd(), 'package.json'));
      const adapterEntry = rootReq.resolve('@prisma/adapter-better-sqlite3', {
        paths: [resolve(process.cwd(), 'database')],
      });
      const adapterReq = createRequire(adapterEntry);
      const Database = adapterReq('better-sqlite3') as new (
        filename: string,
      ) => {
        exec: (sql: string) => void;
        prepare: (sql: string) => {
          get: (...args: unknown[]) => Record<string, unknown> | undefined;
        };
        close: () => void;
      };

      const db = new Database(dbPath);
      db.exec(`
        CREATE TABLE accounts (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          role TEXT NOT NULL,
          created_at DATETIME NOT NULL
        );
        CREATE TABLE admins (
          id TEXT PRIMARY KEY,
          account_id TEXT NOT NULL UNIQUE,
          nama_lengkap TEXT NOT NULL,
          no_hp TEXT NOT NULL,
          alamat TEXT NOT NULL,
          created_at DATETIME NOT NULL,
          updated_at DATETIME NOT NULL
        );
      `);
      db.close();

      const scriptPath = resolve(process.cwd(), 'scripts', 'create-admin.mjs');
      execFileSync(
        process.execPath,
        [
          scriptPath,
          '--username',
          'superadmin',
          '--email',
          'admin@ruangbaca.id',
          '--password',
          'Rahasia123!',
          '--nama-lengkap',
          'Admin Perpustakaan',
          '--no-hp',
          '081234567890',
          '--alamat',
          'Jl. Perpustakaan No. 1',
        ],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            SQLITE_PATH: dbPath,
          },
        },
      );

      const verifyDb = new Database(dbPath);
      const acc = verifyDb
        .prepare('SELECT * FROM accounts WHERE username = ?')
        .get('superadmin') as {
        id: string;
        email: string;
        password: string;
        role: string;
      };
      const adm = verifyDb
        .prepare('SELECT * FROM admins WHERE account_id = ?')
        .get(acc.id) as {
        nama_lengkap: string;
        no_hp: string;
        alamat: string;
      };
      verifyDb.close();

      expect(acc).toBeDefined();
      expect(acc.email).toBe('admin@ruangbaca.id');
      expect(acc.role).toBe('admin');
      expect(await bcrypt.compare('Rahasia123!', acc.password)).toBe(true);
      expect(adm).toMatchObject({
        nama_lengkap: 'Admin Perpustakaan',
        no_hp: '081234567890',
        alamat: 'Jl. Perpustakaan No. 1',
      });
    });

    it('rejects password shorter than 8 characters in create-admin.mjs', () => {
      const dbPath = join(tempDir, 'test-short-pass.sqlite');
      const scriptPath = resolve(process.cwd(), 'scripts', 'create-admin.mjs');

      expect(() =>
        execFileSync(
          process.execPath,
          [
            scriptPath,
            '--username',
            'superadmin',
            '--email',
            'admin@ruangbaca.id',
            '--password',
            '1234567',
            '--nama-lengkap',
            'Admin Perpustakaan',
            '--no-hp',
            '081234567890',
            '--alamat',
            'Jl. Perpustakaan No. 1',
          ],
          {
            cwd: process.cwd(),
            env: {
              ...process.env,
              SQLITE_PATH: dbPath,
            },
            stdio: 'pipe',
          },
        ),
      ).toThrow(/Password minimal harus 8 karakter/);
    });

    it('clears all database tables and resets sequences via scripts/reset-db.mjs', () => {
      const dbPath = join(tempDir, 'test-reset.sqlite');
      const rootReq = createRequire(resolve(process.cwd(), 'package.json'));
      const adapterEntry = rootReq.resolve('@prisma/adapter-better-sqlite3', {
        paths: [resolve(process.cwd(), 'database')],
      });
      const adapterReq = createRequire(adapterEntry);
      const Database = adapterReq('better-sqlite3') as new (
        filename: string,
      ) => {
        exec: (sql: string) => void;
        prepare: (sql: string) => {
          get: (...args: unknown[]) => Record<string, unknown> | undefined;
        };
        close: () => void;
      };

      const db = new Database(dbPath);
      db.exec(`
        CREATE TABLE accounts (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          role TEXT NOT NULL,
          created_at DATETIME NOT NULL
        );
        CREATE TABLE categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nama_kategori TEXT NOT NULL,
          jenis_buku TEXT NOT NULL
        );
        INSERT INTO accounts VALUES ('acc-1', 'u1', 'u1@x.id', 'pass', 'user', '2026-01-01');
        INSERT INTO categories (nama_kategori, jenis_buku) VALUES ('Sains', 'Non-Fiksi');
      `);
      db.close();

      const resetScriptPath = resolve(process.cwd(), 'scripts', 'reset-db.mjs');
      execFileSync(process.execPath, [resetScriptPath, '--yes'], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          SQLITE_PATH: dbPath,
        },
      });

      const verifyDb = new Database(dbPath);
      const accCount = verifyDb
        .prepare('SELECT COUNT(*) AS cnt FROM accounts')
        .get() as { cnt: number };
      const catCount = verifyDb
        .prepare('SELECT COUNT(*) AS cnt FROM categories')
        .get() as { cnt: number };
      verifyDb.close();

      expect(accCount.cnt).toBe(0);
      expect(catCount.cnt).toBe(0);
    });
  });
});
