import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService } from './database.service';

@Injectable()
export class MigrationsService implements OnModuleInit {
  private readonly logger = new Logger('Migrations');

  constructor(private databaseService: DatabaseService) {}

  async onModuleInit() {
    try {
      await this.runMigrations();
    } catch (error) {
      this.logger.error('🚨 CRITICAL: Database migrations failed!', error);
      // In production, we might want to fail fast
      if (process.env.NODE_ENV === 'production') {
        throw error;
      }
    }
  }

  async runMigrations(): Promise<void> {
    try {
      const migrationsDir = path.join(process.cwd(), 'migrations');

      if (!fs.existsSync(migrationsDir)) {
        this.logger.warn('⚠️  Migrations directory not found');
        return;
      }

      // Create applied_migrations table if it doesn't exist
      try {
        await this.databaseService.query(`
          CREATE TABLE IF NOT EXISTS applied_migrations (
            id SERIAL PRIMARY KEY,
            migration_name VARCHAR(255) UNIQUE NOT NULL,
            applied_at TIMESTAMPTZ DEFAULT NOW()
          );
        `);
      } catch (error) {
        // Table might already exist, that's fine
      }

      // Get already applied migrations
      let appliedMigrations: Set<string>;
      try {
        const appliedRes = await this.databaseService.query(
          'SELECT migration_name FROM applied_migrations',
        );
        appliedMigrations = new Set(
          (appliedRes.rows as Array<{ migration_name: string }>).map(
            (row) => row.migration_name,
          ),
        );
      } catch (error) {
        // If table doesn't exist or query fails, assume no migrations applied
        appliedMigrations = new Set();
      }

      const files = fs
        .readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.sql'))
        .sort();

      if (files.length === 0) {
        return; // No files, exit silently
      }

      // Filter out already applied migrations
      const pendingMigrations = files.filter(
        (file) => !appliedMigrations.has(file),
      );

      // Only log if there are migrations to run
      if (pendingMigrations.length === 0) {
        // All migrations already applied, exit silently
        return;
      }

      this.logger.log(
        `🚀 Running ${pendingMigrations.length} pending migration(s)...`,
      );

      let hasAbortedTransaction = false;
      let successCount = 0;

      for (const file of pendingMigrations) {
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf-8');

        try {
          await this.databaseService.query(sql);

          // Mark migration as applied
          await this.databaseService.query(
            'INSERT INTO applied_migrations (migration_name) VALUES ($1) ON CONFLICT (migration_name) DO NOTHING',
            [file],
          );

          this.logger.log(`✅ Executed: ${file}`);
          successCount++;
          hasAbortedTransaction = false; // Reset on success
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          // Check if the error is due to objects already existing
          if (
            errorMessage.includes('already exists') ||
            errorMessage.includes('duplicate')
          ) {
            // Mark as applied even if it already exists
            try {
              await this.databaseService.query(
                'INSERT INTO applied_migrations (migration_name) VALUES ($1) ON CONFLICT (migration_name) DO NOTHING',
                [file],
              );
            } catch {
              // Ignore errors marking as applied
            }
            this.logger.log(`⏭️  Skipped: ${file} (already exists)`);
            successCount++;
            hasAbortedTransaction = false; // Reset on expected error
          } else if (errorMessage.includes('current transaction is aborted')) {
            // This means a previous migration failed and left the connection in a bad state
            // Only log once to avoid spam
            if (!hasAbortedTransaction) {
              this.logger.warn(
                `⚠️  Transaction aborted - skipping remaining migrations due to previous failure`,
              );
              hasAbortedTransaction = true;
            }
            // Skip logging individual failures once we know the transaction is aborted
          } else {
            this.logger.error(`❌ Failed: ${file}`);
            this.logger.error(errorMessage);
            hasAbortedTransaction = true; // Mark that we have an aborted transaction
            // Don't throw - allow app to start even if migration fails
            // In production, you might want to handle this differently
          }
        }
      }

      if (successCount > 0) {
        this.logger.log(`✅ Completed ${successCount} migration(s)`);
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error('❌ Migration process failed:', errorMessage);
      // Don't throw - allow app to continue
    }
  }
}
