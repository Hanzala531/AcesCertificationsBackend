import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { isErrorWithStack } from '../common/utils/error.util';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private pool: Pool;
  private readonly logger = new Logger(DatabaseService.name);

  constructor(private configService: ConfigService) {}

  private isExpectedIdlePoolError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    const normalized = message.toLowerCase();

    return (
      normalized.includes('connection terminated unexpectedly') ||
      normalized.includes('connection lost') ||
      normalized.includes('econnreset') ||
      normalized.includes('etimedout') ||
      normalized.includes('socket hang up')
    );
  }

  async onModuleInit() {
    await this.initializePool();
    if (this.configService.get('database.migrateOnStart')) {
      await this.runMigrations();
    }
  }

  private async initializePool() {
    const dbConfig = this.configService.get<{
      url?: string;
      host: string;
      port: number;
      user: string;
      password: string;
      database: string;
    }>('database');

    if (!dbConfig) {
      throw new Error('Database configuration not found');
    }

    const isNeon = dbConfig.url?.includes('neon.tech');
    const poolMax = parseInt(process.env.DB_POOL_MAX || '10', 10);
    const poolMin = parseInt(
      process.env.DB_POOL_MIN || (isNeon ? '0' : '2'),
      10,
    );

    const poolConfig = {
      max: poolMax,
      min: poolMin,
      idleTimeoutMillis: isNeon ? 10000 : 30000, // Proactively close idle Neon clients before remote idle termination
      connectionTimeoutMillis: isNeon ? 30000 : 15000,
      statement_timeout: 30000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 5000,
      allowExitOnIdle: isNeon, // Let pool shrink to 0 when idle (prevents Neon kills)
      maxLifetimeSeconds: isNeon ? 300 : 0,
    };

    if (dbConfig.url) {
      this.logger.log(`Using DATABASE_URL (pool: ${poolMin}-${poolMax}, neon: ${isNeon})`);
      this.pool = new Pool({
        ...poolConfig,
        connectionString: dbConfig.url,
        ssl: { rejectUnauthorized: false },
      });
    } else {
      this.logger.log(`Using individual DB config (pool: ${poolMin}-${poolMax})`);
      this.pool = new Pool({
        ...poolConfig,
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        password: dbConfig.password,
        database: dbConfig.database,
      });
    }

    this.pool.on('error', (err: unknown) => {
      const msg = isErrorWithStack(err) ? err.stack : String(err);
      if (this.isExpectedIdlePoolError(err)) {
        this.logger.warn(`Idle DB client disconnected by server (auto-recovered): ${msg}`);
        return;
      }

      this.logger.error('Unexpected error on idle client', msg);
    });

    // Test connection with retry (Neon cold starts can take time)
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const client = await this.pool.connect();
        this.logger.log('Database connection established successfully');
        client.release();
        return;
      } catch (error) {
        this.logger.warn(
          `Database connection attempt ${attempt}/${maxRetries} failed: ${error instanceof Error ? error.message : error}`,
        );
        if (attempt === maxRetries) {
          this.logger.error('All database connection attempts failed');
          throw error;
        }
        // Wait before retrying (5s, 10s)
        await new Promise((r) => setTimeout(r, attempt * 5000));
      }
    }
  }

  /** Connection-level errors worth retrying — chiefly Neon serverless cold starts. */
  private isTransientConnectError(error: unknown): boolean {
    const e = error as { code?: string; name?: string; errors?: unknown[] } | null;
    const codes = [
      'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED',
      'ENETUNREACH', 'EHOSTUNREACH', 'EAI_AGAIN',
    ];
    if (e?.code && codes.includes(e.code)) return true;
    // AggregateError (IPv4+IPv6 connect failures) carries no top-level code.
    if (e?.name === 'AggregateError' && Array.isArray(e.errors)) {
      return e.errors.some((inner) => this.isTransientConnectError(inner));
    }
    const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
    return (
      msg.includes('etimedout') ||
      msg.includes('econnreset') ||
      msg.includes('enetunreach') ||
      msg.includes('timeout') ||
      msg.includes('connection terminated')
    );
  }

  /**
   * Acquire a pooled client, retrying transient connection failures. Neon's
   * serverless compute suspends when idle; the first connection after a sleep
   * often times out while the compute wakes — a quick retry then succeeds,
   * instead of bubbling a 500 up to the request (e.g. on login).
   */
  private async connectWithRetry(maxAttempts = 3): Promise<PoolClient> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.pool.connect();
      } catch (error) {
        lastError = error;
        if (attempt === maxAttempts || !this.isTransientConnectError(error)) {
          throw error;
        }
        this.logger.warn(
          `DB connect attempt ${attempt}/${maxAttempts} failed (likely Neon cold start); retrying in ${attempt * 800}ms`,
        );
        await new Promise((r) => setTimeout(r, attempt * 800)); // 800ms, 1600ms
      }
    }
    throw lastError;
  }

  async getClient() {
    const client = await this.connectWithRetry();
    // Prevent unhandled 'error' events on a checked-out client from crashing the process.
    // Why: pool.on('error') only covers idle clients; if the socket dies mid-query the
    // Client itself emits 'error' and Node aborts if nothing is listening.
    const onError = (err: unknown) => {
      if (this.isExpectedIdlePoolError(err)) {
        this.logger.warn(
          `Active DB client disconnected: ${err instanceof Error ? err.message : String(err)}`,
        );
      } else {
        this.logger.error(
          'Unexpected error on active client',
          isErrorWithStack(err) ? err.stack : String(err),
        );
      }
    };
    client.on('error', onError);
    const origRelease = client.release.bind(client);
    (client as unknown as { release: (destroy?: boolean) => void }).release = (
      destroy?: boolean,
    ) => {
      client.removeListener('error', onError);
      origRelease(destroy);
    };
    return client;
  }

  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.getClient();
    let shouldDestroy = false;
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ROLLBACK failed — connection is broken, must not reuse
        shouldDestroy = true;
      }
      throw error;
    } finally {
      client.release(shouldDestroy);
    }
  }

  async query(text: string, params?: unknown[]) {
    const client = await this.getClient();
    try {
      const res = await client.query(text, params);
      client.release();
      return res;
    } catch (error) {
      // Query failed — connection may be in a dirty state, destroy it
      client.release(true);
      throw error;
    }
  }

  async runMigrations() {
    this.logger.log('Running database migrations...');

    // Create applied_migrations table if not exists
    await this.query(`
      CREATE TABLE IF NOT EXISTS applied_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Get applied migrations
    const appliedRes = await this.query(
      'SELECT migration_name FROM applied_migrations',
    );
    const appliedMigrations = new Set(
      (appliedRes.rows as Array<{ migration_name: string }>).map(
        (row) => row.migration_name,
      ),
    );

    // Get migration files
    const migrationsDir = path.join(process.cwd(), 'migrations');
    const files = fs.readdirSync(migrationsDir).sort(); // lexical sort

    for (const file of files) {
      if (!file.endsWith('.sql') || appliedMigrations.has(file)) continue;

      this.logger.log(`Applying migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

      const client = await this.getClient();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO applied_migrations (migration_name) VALUES ($1)',
          [file],
        );
        await client.query('COMMIT');
        this.logger.log(`Migration ${file} applied successfully`);
      } catch (error) {
        await client.query('ROLLBACK');
        const errAny = error;
        const msg = isErrorWithStack(error)
          ? (errAny.stack ?? String(error))
          : String(error);

        // If migration failed because an object already exists, mark as applied and continue.
        if (errAny?.code === '42P07' || /already exists/i.test(String(error))) {
          this.logger.warn(
            `Migration ${file} appears already applied: ${String(error)}`,
          );
          try {
            await client.query('BEGIN');
            await client.query(
              'INSERT INTO applied_migrations (migration_name) VALUES ($1)',
              [file],
            );
            await client.query('COMMIT');
            this.logger.log(
              `Marked migration ${file} as applied (skipped duplicate)`,
            );
          } catch (markErr) {
            await client.query('ROLLBACK').catch(() => {});
            this.logger.error(
              `Failed to mark migration ${file} as applied:`,
              markErr,
            );
            throw error;
          }
        } else {
          this.logger.error(`Failed to apply migration ${file}:`, error);
          throw error;
        }
      } finally {
        client.release();
      }
    }

    this.logger.log('All migrations applied');
  }

  async close() {
    await this.pool.end();
  }
}
