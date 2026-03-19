import mysql from "mysql2/promise";

let pool: mysql.Pool | null = null;
const tableExistsCache = new Map<string, { expiresAt: number; promise: Promise<boolean> }>();
const tableColumnsCache = new Map<string, { expiresAt: number; promise: Promise<string[]> }>();
const connectionTimeoutCacheKey = "__rptSaesMaxExecutionTime";

const useSsl = (process.env.DB_SSL ?? "").trim().toLowerCase() === "true";
const logQueryTimings = ["1", "true", "yes", "on"].includes(
  (process.env.DB_QUERY_TIMING_LOG ?? "").trim().toLowerCase(),
);
const metadataCacheTtlMs = process.env.DB_METADATA_CACHE_TTL_MS
  ? Number(process.env.DB_METADATA_CACHE_TTL_MS)
  : 5 * 60 * 1000;
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
    
    // Add connection timeout settings
    connectTimeout: 10000, // 10 seconds
    idleTimeout: 60000, // 60 seconds idle timeout
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000, // 10 seconds
    
    // Add maxIdle to prevent connection churn
    maxIdle: Math.max(1, Math.floor(DB_CONFIG.connectionLimit / 2)), // Half of connection limit
  });

  return pool;
}

export function getPool(): mysql.Pool {
  return ensurePool();
}

export type QueryParams = Array<string | number | null | undefined | Buffer | Date>;

function normalizeCacheKey(tableName: string): string {
  return tableName.trim().toLowerCase();
}

function getCacheExpiry(): number {
  const ttlMs = Number.isFinite(metadataCacheTtlMs) ? metadataCacheTtlMs : 5 * 60 * 1000;
  return Date.now() + Math.max(1000, ttlMs);
}

function invalidateMetadataCaches(tableName?: string): void {
  if (!tableName) {
    tableExistsCache.clear();
    tableColumnsCache.clear();
    return;
  }

  const key = normalizeCacheKey(tableName);
  tableExistsCache.delete(key);
  tableColumnsCache.delete(key);
}

function extractMutatedTableNames(sql: string): string[] {
  const normalized = sql.replace(/\s+/g, " ").trim();
  const renameMatch = normalized.match(
    /^RENAME TABLE\s+`?([A-Za-z0-9_]+)`?\s+TO\s+`?([A-Za-z0-9_]+)`?/i,
  );
  if (renameMatch) {
    return [renameMatch[1], renameMatch[2]];
  }

  const singleTableMatch = normalized.match(
    /^(ALTER|DROP)\s+TABLE(?:\s+IF\s+EXISTS)?\s+`?([A-Za-z0-9_]+)`?/i,
  );
  if (singleTableMatch) {
    return [singleTableMatch[2]];
  }

  return [];
}

async function applyConnectionTimeout(
  connection: mysql.PoolConnection,
  timeout: number,
): Promise<void> {
  if (timeout <= 0) {
    return;
  }

  const trackedConnection = connection as mysql.PoolConnection & {
    [connectionTimeoutCacheKey]?: number;
  };

  if (trackedConnection[connectionTimeoutCacheKey] === timeout) {
    return;
  }

  await connection.query(`SET SESSION max_execution_time = ${timeout}`);
  trackedConnection[connectionTimeoutCacheKey] = timeout;
}

function summarizeSql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim().slice(0, 180);
}

function emitQueryTimingLog(
  phase: "ok" | "error",
  durationMs: number,
  sql: string,
  params: QueryParams,
  errorCode?: string,
): void {
  if (!logQueryTimings) {
    return;
  }

  const prefix = phase === "error" ? "[db-timing:error]" : "[db-timing]";
  const suffix = errorCode ? ` code=${errorCode}` : "";
  console.log(
    `${prefix} ${durationMs.toFixed(2)}ms params=${params.length}${suffix} sql="${summarizeSql(sql)}"`,
  );
}

/**
 * Executes a query with retry logic for connection errors
 */
export async function query<T extends mysql.RowDataPacket[] | mysql.ResultSetHeader>(
  sql: string,
  params: QueryParams = [],
  options: {
    retries?: number;
    retryDelay?: number;
    timeout?: number;
  } = {}
): Promise<[T, mysql.FieldPacket[]]> {
  const { retries = 3, retryDelay = 1000, timeout = 30000 } = options;
  let lastError: any;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const db = ensurePool();
      
      // Use a connection from pool for timeout control
      const connection = await db.getConnection();
      
      try {
        await applyConnectionTimeout(connection, timeout);

        const startedAt = process.hrtime.bigint();
        try {
          const result = await connection.query<T>(sql, params);
          emitQueryTimingLog("ok", Number(process.hrtime.bigint() - startedAt) / 1_000_000, sql, params);
          for (const tableName of extractMutatedTableNames(sql)) {
            invalidateMetadataCaches(tableName);
          }
          return result;
        } catch (error: any) {
          emitQueryTimingLog(
            "error",
            Number(process.hrtime.bigint() - startedAt) / 1_000_000,
            sql,
            params,
            error?.code,
          );
          throw error;
        }
      } finally {
        connection.release();
      }
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a connection error that warrants a retry
      const isConnectionError = 
        error.code === 'ECONNRESET' ||
        error.code === 'PROTOCOL_CONNECTION_LOST' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'EHOSTUNREACH' ||
        error.code === 'ECONNREFUSED';
      
      if (isConnectionError && attempt < retries) {
        console.warn(`Database connection error (attempt ${attempt + 1}/${retries + 1}): ${error.code}. Retrying in ${retryDelay}ms...`);
        
        // Reset the pool to get fresh connections
        if (pool) {
          try {
            await pool.end();
          } catch {
            // Ignore errors during pool cleanup
          }
          pool = null;
        }
        
        // Wait before retrying (with exponential backoff)
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
        continue;
      }
      
      // If not a connection error or no retries left, throw
      throw error;
    }
  }
  
  throw lastError;
}

/**
 * Helper function for operations that need automatic retry
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      if (error.code === 'ECONNRESET' || 
          error.code === 'PROTOCOL_CONNECTION_LOST' ||
          error.code === 'ETIMEDOUT') {
        
        if (i < maxRetries - 1) {
          console.log(`Retry ${i + 1}/${maxRetries} after connection error: ${error.code}`);
          
          // Reset pool before retry
          if (pool) {
            try {
              await pool.end();
            } catch {
              // Ignore cleanup errors
            }
            pool = null;
          }
          
          await new Promise(resolve => setTimeout(resolve, delayMs * (i + 1)));
          continue;
        }
      }
      throw error;
    }
  }
  
  throw lastError!;
}

/**
 * Checks if the database connection is healthy
 */
export async function checkConnection(): Promise<boolean> {
  try {
    await query('SELECT 1', [], { retries: 1, timeout: 5000 });
    return true;
  } catch (error) {
    console.error('Database connection check failed:', error);
    return false;
  }
}

export async function tableExists(tableName: string): Promise<boolean> {
  const cacheKey = normalizeCacheKey(tableName);
  const cached = tableExistsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.promise;
  }

  tableExistsCache.delete(cacheKey);

  const promise = (async () => {
    const [rows] = await query<mysql.RowDataPacket[]>(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1`,
      [tableName],
      { timeout: 10000 }
    );
    const exists = rows.length > 0;
    if (!exists) {
      tableExistsCache.delete(cacheKey);
    }
    return exists;
  })().catch((error) => {
    tableExistsCache.delete(cacheKey);
    throw error;
  });

  tableExistsCache.set(cacheKey, { expiresAt: getCacheExpiry(), promise });
  return promise;
}

export async function getTableColumns(tableName: string): Promise<Set<string>> {
  const cacheKey = normalizeCacheKey(tableName);
  const cached = tableColumnsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return new Set(await cached.promise);
  }

  tableColumnsCache.delete(cacheKey);

  const promise = (async () => {
    try {
      const [rows] = await query<mysql.RowDataPacket[]>(
        `SHOW COLUMNS FROM \`${tableName}\``,
        [],
        { timeout: 10000 }
      );
      const columns = rows.map((row) => row.Field as string);
      if (columns.length === 0) {
        tableColumnsCache.delete(cacheKey);
      }
      return columns;
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (code === "ER_NO_SUCH_TABLE" || code === "ER_BAD_TABLE_ERROR") {
        tableColumnsCache.delete(cacheKey);
        return [];
      }
      tableColumnsCache.delete(cacheKey);
      throw error;
    }
  })();

  tableColumnsCache.set(cacheKey, { expiresAt: getCacheExpiry(), promise });
  return new Set(await promise);
}

export async function runWithConnection<T>(
  handler: (connection: mysql.PoolConnection) => Promise<T>,
  options: {
    retries?: number;
    retryDelay?: number;
  } = {}
): Promise<T> {
  const { retries = 2, retryDelay = 1000 } = options;
  let lastError: any;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const db = ensurePool();
      const connection = await db.getConnection();
      try {
        return await handler(connection);
      } finally {
        connection.release();
      }
    } catch (error: any) {
      lastError = error;
      
      if ((error.code === 'ECONNRESET' || error.code === 'PROTOCOL_CONNECTION_LOST') && 
          attempt < retries) {
        console.warn(`Connection error in runWithConnection (attempt ${attempt + 1}). Retrying...`);
        
        if (pool) {
          try {
            await pool.end();
          } catch {
            // Ignore cleanup errors
          }
          pool = null;
        }
        
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
        continue;
      }
      throw error;
    }
  }
  
  throw lastError;
}

/**
 * Cleanup function to call during application shutdown
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
  invalidateMetadataCaches();
}
