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
        // Set query timeout if specified
        if (timeout > 0) {
          await connection.query(`SET SESSION max_execution_time = ${timeout}`);
        }
        
        const result = await connection.query<T>(sql, params);
        return result;
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
  const [rows] = await query<mysql.RowDataPacket[]>(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1`,
    [tableName],
    { timeout: 10000 } // 10 second timeout for metadata query
  );
  return rows.length > 0;
}

export async function getTableColumns(tableName: string): Promise<Set<string>> {
  try {
    const [rows] = await query<mysql.RowDataPacket[]>(
      `SHOW COLUMNS FROM \`${tableName}\``,
      [],
      { timeout: 10000 }
    );
    return new Set(rows.map((row) => row.Field as string));
  } catch (error) {
    // Gracefully handle missing tables so callers can skip optional sources.
    const code = (error as { code?: string } | null)?.code;
    if (code === "ER_NO_SUCH_TABLE" || code === "ER_BAD_TABLE_ERROR") {
      return new Set<string>();
    }
    throw error;
  }
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
}