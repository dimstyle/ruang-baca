import { createRequire } from 'node:module';
import { convertSqlitePlaceholdersToPg } from './database-config';

type ColumnType = number;

type SqlQuery = {
  sql: string;
  args: Array<unknown>;
  argTypes: Array<{ scalarType: string; arity: string }>;
};

type SqlResultSet = {
  columnTypes: Array<ColumnType>;
  columnNames: Array<string>;
  rows: Array<Array<unknown>>;
  lastInsertId?: string;
};

type PgResultValues = Array<Array<unknown>> & {
  columns?: Array<{ name: string; type: number }>;
  count?: number;
};

type PgSqlClient = {
  unsafe: (
    query: string,
    args?: Array<unknown>,
  ) => Promise<{ count?: number }> & {
    values: () => Promise<PgResultValues>;
  };
  reserve?: () => Promise<PgSqlClient & { release: () => void }>;
  end?: (opts?: { timeout?: number }) => Promise<void>;
};

const adapterReq = createRequire(
  require.resolve('@prisma/adapter-better-sqlite3'),
);
const driverAdapterUtils = adapterReq('@prisma/driver-adapter-utils') as {
  ColumnTypeEnum: Record<string, number>;
  DriverAdapterError: new (payload: Record<string, unknown>) => Error;
};

const { ColumnTypeEnum, DriverAdapterError } = driverAdapterUtils;

function loadPostgresDriver(): (
  url: string,
  options?: Record<string, unknown>,
) => PgSqlClient {
  try {
    const prismaReq = createRequire(require.resolve('prisma/config'));
    const mod = prismaReq('postgres') as
      | ((url: string, opts?: Record<string, unknown>) => PgSqlClient)
      | {
          default: (url: string, opts?: Record<string, unknown>) => PgSqlClient;
        };
    return typeof mod === 'function' ? mod : mod.default;
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('postgres') as
      | ((url: string, opts?: Record<string, unknown>) => PgSqlClient)
      | {
          default: (url: string, opts?: Record<string, unknown>) => PgSqlClient;
        };
    return typeof mod === 'function' ? mod : mod.default;
  }
}

function mapPgOidToColumnType(oid: number, sampleVal: unknown): ColumnType {
  switch (oid) {
    case 16: // bool
      return ColumnTypeEnum.Boolean;
    case 20: // int8
      return ColumnTypeEnum.Int64;
    case 21: // int2
    case 23: // int4
    case 26: // oid
      return ColumnTypeEnum.Int32;
    case 700: // float4
      return ColumnTypeEnum.Float;
    case 701: // float8
      return ColumnTypeEnum.Double;
    case 1700: // numeric
      return ColumnTypeEnum.Numeric;
    case 1082: // date
      return ColumnTypeEnum.Date;
    case 1083: // time
    case 1266: // timetz
      return ColumnTypeEnum.Time;
    case 1114: // timestamp
    case 1184: // timestamptz
      return ColumnTypeEnum.DateTime;
    case 2950: // uuid
      return ColumnTypeEnum.Uuid;
    case 114: // json
    case 3802: // jsonb
      return ColumnTypeEnum.Json;
    case 17: // bytea
      return ColumnTypeEnum.Bytes;
    default:
      if (typeof sampleVal === 'boolean') return ColumnTypeEnum.Boolean;
      if (typeof sampleVal === 'number') {
        return Number.isInteger(sampleVal)
          ? ColumnTypeEnum.Int32
          : ColumnTypeEnum.Double;
      }
      if (typeof sampleVal === 'bigint') return ColumnTypeEnum.Int64;
      if (sampleVal instanceof Date) return ColumnTypeEnum.DateTime;
      return ColumnTypeEnum.Text;
  }
}

function normalizeArg(arg: unknown, scalarType?: string): unknown {
  if (arg === null || arg === undefined) return null;
  if (arg instanceof Date) return arg.toISOString();
  if (typeof arg === 'string' && scalarType === 'int') {
    const parsed = Number.parseInt(arg, 10);
    return Number.isNaN(parsed) ? arg : parsed;
  }
  if (
    typeof arg === 'string' &&
    (scalarType === 'float' || scalarType === 'decimal')
  ) {
    const parsed = Number.parseFloat(arg);
    return Number.isNaN(parsed) ? arg : parsed;
  }
  return arg;
}

function normalizeCell(val: unknown, colType: ColumnType): unknown {
  if (val === null || val === undefined) return null;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'bigint') {
    const num = Number(val);
    return Number.isSafeInteger(num) ? num : val.toString();
  }
  if (
    typeof val === 'string' &&
    (colType === ColumnTypeEnum.Int32 ||
      colType === ColumnTypeEnum.Int64 ||
      colType === ColumnTypeEnum.Double ||
      colType === ColumnTypeEnum.Float ||
      colType === ColumnTypeEnum.Numeric)
  ) {
    const num = Number(val);
    if (!Number.isNaN(num)) return num;
  }
  return val;
}

function convertPgError(err: unknown): Record<string, unknown> {
  const e = err as Record<string, unknown> | undefined;
  const code = typeof e?.code === 'string' ? e.code : '';
  const message =
    typeof e?.message === 'string' ? e.message : String(err ?? 'Unknown error');

  if (code === '23505') {
    return {
      originalCode: code,
      originalMessage: message,
      kind: 'UniqueConstraintViolation',
      constraint:
        typeof e?.constraint_name === 'string'
          ? { index: e.constraint_name }
          : undefined,
      table: typeof e?.table_name === 'string' ? e.table_name : undefined,
    };
  }

  if (code === '23503' || code === '23001') {
    return {
      originalCode: code,
      originalMessage: message,
      kind: 'ForeignKeyConstraintViolation',
      constraint: { foreignKey: {} },
    };
  }

  if (code === '23502') {
    return {
      originalCode: code,
      originalMessage: message,
      kind: 'NullConstraintViolation',
      constraint:
        typeof e?.column_name === 'string'
          ? { fields: [e.column_name] }
          : undefined,
    };
  }

  return {
    originalCode: code || 'PG_ERROR',
    originalMessage: message,
    kind: 'postgres',
    code: code || 'PG_ERROR',
    severity: typeof e?.severity === 'string' ? e.severity : 'ERROR',
    message,
    detail: typeof e?.detail === 'string' ? e.detail : undefined,
    column: typeof e?.column_name === 'string' ? e.column_name : undefined,
    hint: typeof e?.hint === 'string' ? e.hint : undefined,
  };
}

class PostgresQueryable {
  readonly provider = 'postgres' as const;
  readonly adapterName = '@prisma/adapter-pg' as const;

  constructor(protected readonly client: PgSqlClient) {}

  async queryRaw(query: SqlQuery): Promise<SqlResultSet> {
    try {
      const pgSql = convertSqlitePlaceholdersToPg(query.sql);
      const args = query.args.map((arg, idx) =>
        normalizeArg(arg, query.argTypes?.[idx]?.scalarType),
      );
      const res = await this.client.unsafe(pgSql, args).values();
      const columns = res.columns ?? [];
      const columnNames = columns.map((c) => c.name);
      const columnTypes = columns.map((c, idx) => {
        const sample = res.find((r) => r[idx] !== null && r[idx] !== undefined);
        return mapPgOidToColumnType(c.type, sample?.[idx]);
      });
      const rows = res.map((row) =>
        row.map((cell, idx) => normalizeCell(cell, columnTypes[idx])),
      );

      return {
        columnNames,
        columnTypes,
        rows,
      };
    } catch (e) {
      throw new DriverAdapterError(convertPgError(e));
    }
  }

  async executeRaw(query: SqlQuery): Promise<number> {
    try {
      const pgSql = convertSqlitePlaceholdersToPg(query.sql);
      const args = query.args.map((arg, idx) =>
        normalizeArg(arg, query.argTypes?.[idx]?.scalarType),
      );
      const res = await this.client.unsafe(pgSql, args);
      return Number(res.count ?? 0);
    } catch (e) {
      throw new DriverAdapterError(convertPgError(e));
    }
  }
}

class PostgresTransaction extends PostgresQueryable {
  readonly options = { usePhantomQuery: false };

  constructor(
    client: PgSqlClient,
    private readonly releaseConn: () => void,
  ) {
    super(client);
  }

  async commit(): Promise<void> {
    try {
      await this.client.unsafe('COMMIT');
    } finally {
      this.releaseConn();
    }
  }

  async rollback(): Promise<void> {
    try {
      await this.client.unsafe('ROLLBACK');
    } finally {
      this.releaseConn();
    }
  }

  async createSavepoint(name: string): Promise<void> {
    await this.client.unsafe(`SAVEPOINT ${name}`);
  }

  async rollbackToSavepoint(name: string): Promise<void> {
    await this.client.unsafe(`ROLLBACK TO SAVEPOINT ${name}`);
  }

  async releaseSavepoint(name: string): Promise<void> {
    await this.client.unsafe(`RELEASE SAVEPOINT ${name}`);
  }
}

class PrismaPostgresAdapter extends PostgresQueryable {
  async executeScript(script: string): Promise<void> {
    try {
      await this.client.unsafe(script);
    } catch (e) {
      throw new DriverAdapterError(convertPgError(e));
    }
  }

  async startTransaction(isolationLevel?: string): Promise<PostgresTransaction> {
    if (!this.client.reserve) {
      await this.client.unsafe('BEGIN');
      return new PostgresTransaction(this.client, () => {});
    }

    const reserved = await this.client.reserve();
    try {
      if (isolationLevel) {
        await reserved.unsafe(
          `BEGIN ISOLATION LEVEL ${isolationLevel}`,
        );
      } else {
        await reserved.unsafe('BEGIN');
      }
      return new PostgresTransaction(reserved, () => reserved.release());
    } catch (e) {
      reserved.release();
      throw new DriverAdapterError(convertPgError(e));
    }
  }

  getConnectionInfo() {
    return {
      schemaName: 'public',
      supportsRelationJoins: true,
    };
  }

  async dispose(): Promise<void> {
    if (this.client.end) {
      await this.client.end({ timeout: 5 });
    }
  }
}

export class PrismaPostgresAdapterFactory {
  readonly provider = 'postgres' as const;
  readonly adapterName = '@prisma/adapter-pg' as const;

  constructor(
    private readonly config: { url: string },
    private readonly customClient?: PgSqlClient,
  ) {}

  connect(): Promise<PrismaPostgresAdapter> {
    if (this.customClient) {
      return Promise.resolve(new PrismaPostgresAdapter(this.customClient));
    }
    const postgres = loadPostgresDriver();
    const sql = postgres(this.config.url, {
      max: 10,
      onnotice: () => {},
    });
    return Promise.resolve(new PrismaPostgresAdapter(sql));
  }
}
