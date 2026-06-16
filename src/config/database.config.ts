import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => ({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'password',
  database: process.env.DB_NAME || 'aces_db',
  url: process.env.DATABASE_URL || process.env.NEON_DATABASE_URL,
  migrateOnStart: process.env.MIGRATE_ON_START === 'true' || false,
}));

export default databaseConfig;
