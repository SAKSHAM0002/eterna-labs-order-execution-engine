// Database Connection Pool - PostgreSQL connection management with pg library
// Singleton pattern ensures single pool instance

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { env, getDatabaseUrl } from '@/order-execution-engine/config';
import { DATABASE_CONFIG } from '@/order-execution-engine/config';
import { Logger } from '@/common/logger';

// PostgreSQL Connection Pool - Manages database connections efficiently with connection pooling
class DatabasePool {
  private static instance: DatabasePool;
  private pool: Pool;

  private constructor() {
    this.pool = new Pool({
      connectionString: getDatabaseUrl(),
      ssl: env.DB_SSL ? { rejectUnauthorized: false } : false,
      min: env.DB_POOL_MIN,
      max: env.DB_POOL_MAX,
      connectionTimeoutMillis: DATABASE_CONFIG.CONNECTION_TIMEOUT,
      idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
      query_timeout: DATABASE_CONFIG.QUERY_TIMEOUT,
      statement_timeout: DATABASE_CONFIG.STATEMENT_TIMEOUT,
    });

    // Event listeners for connection pool monitoring
    this.pool.on('connect', () => {
      Logger.getInstance().debug('New database client connected');
    });

    this.pool.on('error', (poolError: Error) => {
      Logger.getInstance().error('Unexpected database pool error', { error: poolError.message });
    });

    this.pool.on('remove', () => {
      Logger.getInstance().debug('Database client removed from pool');
    });
  }

  // Get singleton instance
  public static getInstance(): DatabasePool {
    if (!DatabasePool.instance) {
      DatabasePool.instance = new DatabasePool();
    }
    return DatabasePool.instance;
  }

  // Execute a SQL query (parameterized queries prevent SQL injection)
  async query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const start = Date.now();
    try {
      const queryResult = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;

      Logger.getInstance().debug('Executed query', {
        query: text,
        duration: `${duration}ms`,
        rows: queryResult.rowCount,
      });

      return queryResult;
    } catch (queryError) {
      Logger.getInstance().error('Database query failed', {
        error: queryError instanceof Error ? queryError.message : String(queryError),
        query: text,
        params,
      });
      throw queryError;
    }
  }

  // Get a client from the pool (for transactions) - Important: Must call client.release() when done!
  async getClient(): Promise<PoolClient> {
    try {
      const client = await this.pool.connect();
      Logger.getInstance().debug('Database client acquired from pool');
      return client;
    } catch (error) {
      Logger.getInstance().error('Failed to get database client', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // Execute a transaction - Automatically handles BEGIN, COMMIT, and ROLLBACK
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient();

    try {
      await client.query('BEGIN');
      Logger.getInstance().debug('Transaction started');

      const transactionResult = await callback(client);

      await client.query('COMMIT');
      Logger.getInstance().debug('Transaction committed');

      return transactionResult;
    } catch (transactionError) {
      await client.query('ROLLBACK');
      Logger.getInstance().error('Transaction rolled back', {
        error: transactionError instanceof Error ? transactionError.message : String(transactionError),
      });
      throw transactionError;
    } finally {
      client.release();
      Logger.getInstance().debug('Database client released');
    }
  }

  // Check database connection health
  async healthCheck(): Promise<boolean> {
    try {
      const healthCheckResult = await this.query('SELECT 1 as health');
      return healthCheckResult.rows[0]?.health === 1;
    } catch (healthCheckError) {
      Logger.getInstance().error('Database health check failed', {
        error: healthCheckError instanceof Error ? healthCheckError.message : String(healthCheckError),
      });
      return false;
    }
  }

  // Get pool statistics
  getStats() {
    return {
      totalCount: this.pool.totalCount,     // Total clients in pool
      idleCount: this.pool.idleCount,       // Idle clients
      waitingCount: this.pool.waitingCount, // Waiting requests
    };
  }

  // Close all connections (for graceful shutdown)
  async close(): Promise<void> {
    try {
      await this.pool.end();
      Logger.getInstance().info('Database pool closed');
    } catch (error) {
      Logger.getInstance().error('Error closing database pool', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

// Export singleton instance
export const database = DatabasePool.getInstance();

// Export class for type definitions
export default DatabasePool;
