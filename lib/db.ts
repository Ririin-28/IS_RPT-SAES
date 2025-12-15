import mysql from "mysql2/promise";

let pool: mysql.Pool | null = null;

const useSsl = (process.env.DB_SSL ?? "").trim().toLowerCase() === "true";
const sslRejectUnauthorized = (process.env.DB_SSL_REJECT_UNAUTHORIZED ?? "true")
  .trim()
  .toLowerCase() !== "false";

const DB_CONFIG = {
  host: process.env.DB_HOST ?? "localhost",
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASSWORD ?? "RIANA28@eg564",
  database: process.env.DB_DATABASE ?? process.env.DB_NAME ?? "rpt-saes_db",
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  connectionLimit: process.env.DB_CONNECTION_LIMIT
    ? Number(process.env.DB_CONNECTION_LIMIT)
    : 10,
  ssl: useSsl
    ? {
        rejectUnauthorized: sslRejectUnauthorized,
      }
    : undefined,
} as const;

function ensurePool(): mysql.Pool {
  if (pool) {
    return pool;
  }

  pool = mysql.createPool({
    ...DB_CONFIG,
    waitForConnections: true,
    queueLimit: 0,
    namedPlaceholders: true,
  });

  return pool;
}

export function getPool(): mysql.Pool {
  return ensurePool();
}

export type QueryParams = Array<string | number | null | undefined | Buffer>;

export async function query<T extends mysql.RowDataPacket[] | mysql.ResultSetHeader>(
  sql: string,
  params: QueryParams = []
): Promise<[T, mysql.FieldPacket[]]> {
  const db = ensurePool();
  return db.query<T>(sql, params);
}

export async function tableExists(tableName: string): Promise<boolean> {
  const db = ensurePool();
  const [rows] = await db.query<mysql.RowDataPacket[]>(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1`,
    [tableName]
  );
  return rows.length > 0;
}

export async function getTableColumns(tableName: string): Promise<Set<string>> {
  const db = ensurePool();
  const [rows] = await db.query<mysql.RowDataPacket[]>(`SHOW COLUMNS FROM \`${tableName}\``);
  return new Set(rows.map((row) => row.Field as string));
}

export async function runWithConnection<T>(
  handler: (connection: mysql.PoolConnection) => Promise<T>
): Promise<T> {
  const db = ensurePool();
  const connection = await db.getConnection();
  try {
    return await handler(connection);
  } finally {
    connection.release();
  }
}
