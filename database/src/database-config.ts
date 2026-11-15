import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

export type DatabaseProvider = 'sqlite' | 'postgresql';

export type DatabaseConfig =
  | {
      provider: 'sqlite';
      url: string;
      sqlitePath: string;
    }
  | {
      provider: 'postgresql';
      url: string;
      postgres: {
        host: string;
        port: number;
        username: string;
        password: string;
        database: string;
      };
    };

export const MISSING_DB_CONFIG_MESSAGE =
  '[Ruang Baca Database] Konfigurasi database tidak ditemukan di .env! ' +
  'Silakan gunakan salah satu: (1) isi SQLITE_PATH untuk menggunakan SQLite, atau ' +
  '(2) kosongkan SQLITE_PATH dan isi POSTGRESS_USERNAME, POSTGRESS_PASSWORD, serta POSTGRESS_DATABASE untuk menggunakan PostgreSQL.';

function parseEnvFile(filePath: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!existsSync(filePath)) return result;

  const content = readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) continue;
    const key = line.slice(0, eqIndex).trim();
    let val = line.slice(eqIndex + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    result[key] = val;
  }
  return result;
}

/**
 * Resolves the active database engine (SQLite vs PostgreSQL) from .env / process.env.
 * Priority:
 * 1. If SQLITE_PATH is set and non-empty -> SQLite.
 * 2. Else if PostgreSQL credentials (POSTGRESS_USERNAME, POSTGRESS_PASSWORD, POSTGRESS_DATABASE)
 *    or a postgres:// DATABASE_URL are set -> PostgreSQL.
 * 3. Else -> Throws a descriptive error prompting the developer to configure one of them.
 */
export function resolveDatabaseConfig(
  customEnv?: NodeJS.ProcessEnv,
  options?: { cwd?: string; loadDotEnv?: boolean },
): DatabaseConfig {
  const workspaceRoot = options?.cwd ?? resolve(__dirname, '..', '..');
  const shouldLoadDotEnv = options?.loadDotEnv ?? customEnv === undefined;

  let mergedEnv: Record<string, string | undefined> = {
    ...(customEnv ?? process.env),
  };

  if (shouldLoadDotEnv) {
    const candidates = [
      resolve(process.cwd(), '.env'),
      resolve(workspaceRoot, '.env'),
    ];
    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        const fileVars = parseEnvFile(candidate);
        mergedEnv = { ...fileVars, ...mergedEnv };
        break;
      }
    }
  }

  const sqlitePath = (mergedEnv.SQLITE_PATH ?? '').trim();
  if (sqlitePath) {
    const rawPath = sqlitePath.replace(/^file:/, '');
    const absPath = isAbsolute(rawPath)
      ? rawPath
      : resolve(workspaceRoot, rawPath);
    return {
      provider: 'sqlite',
      url: `file:${absPath}`,
      sqlitePath: absPath,
    };
  }

  const pgUser = (
    mergedEnv.POSTGRESS_USERNAME ??
    mergedEnv.POSTGRES_USERNAME ??
    mergedEnv.POSTGRES_USER ??
    ''
  ).trim();
  const pgPassword = (
    mergedEnv.POSTGRESS_PASSWORD ??
    mergedEnv.POSTGRES_PASSWORD ??
    ''
  ).trim();
  const pgDatabase = (
    mergedEnv.POSTGRESS_DATABASE ??
    mergedEnv.POSTGRES_DATABASE ??
    mergedEnv.POSTGRES_DB ??
    ''
  ).trim();
  const pgHost =
    (mergedEnv.POSTGRESS_HOST ?? mergedEnv.POSTGRES_HOST ?? '').trim() ||
    'localhost';
  const pgPortRaw =
    (mergedEnv.POSTGRESS_PORT ?? mergedEnv.POSTGRES_PORT ?? '').trim() ||
    '5432';
  const pgPort = Number(pgPortRaw) || 5432;

  const explicitDbUrl = (mergedEnv.DATABASE_URL ?? '').trim();
  const isPostgresUrl = /^postgres(ql)?:\/\//i.test(explicitDbUrl);

  if ((pgUser && pgPassword && pgDatabase) || isPostgresUrl) {
    const url = isPostgresUrl
      ? explicitDbUrl
      : `postgresql://${encodeURIComponent(pgUser)}:${encodeURIComponent(pgPassword)}@${pgHost}:${pgPort}/${encodeURIComponent(pgDatabase)}`;

    return {
      provider: 'postgresql',
      url,
      postgres: {
        host: pgHost,
        port: pgPort,
        username: pgUser,
        password: pgPassword,
        database: pgDatabase,
      },
    };
  }

  throw new Error(MISSING_DB_CONFIG_MESSAGE);
}

/**
 * Converts SQLite `?` positional placeholders to PostgreSQL `$1, $2, ...`
 * while preserving `?` characters inside single/double quotes or SQL comments.
 */
export function convertSqlitePlaceholdersToPg(sql: string): string {
  let out = '';
  let paramIndex = 0;
  let inSingle = false;
  let inDouble = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      out += ch;
      if (ch === '\n') inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      out += ch;
      if (ch === '*' && next === '/') {
        out += '/';
        i++;
        inBlockComment = false;
      }
      continue;
    }

    if (inSingle) {
      out += ch;
      if (ch === "'" && next === "'") {
        out += "'";
        i++;
      } else if (ch === "'") {
        inSingle = false;
      }
      continue;
    }

    if (inDouble) {
      out += ch;
      if (ch === '"' && next === '"') {
        out += '"';
        i++;
      } else if (ch === '"') {
        inDouble = false;
      }
      continue;
    }

    if (ch === '-' && next === '-') {
      out += '--';
      i++;
      inLineComment = true;
      continue;
    }

    if (ch === '/' && next === '*') {
      out += '/*';
      i++;
      inBlockComment = true;
      continue;
    }

    if (ch === "'") {
      out += ch;
      inSingle = true;
      continue;
    }

    if (ch === '"') {
      out += ch;
      inDouble = true;
      continue;
    }

    if (ch === '?') {
      paramIndex += 1;
      out += `$${paramIndex}`;
      continue;
    }

    out += ch;
  }

  return out;
}
