import type { MigrationOptions } from './types';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { getDatabaseUrl } from './get-database-url';
import { validateMigrationJournal } from './validate-migration-journal';

/** Validate history and apply pending migrations, always closing the connection. */
export async function runMigrations(options: MigrationOptions): Promise<void> {
  validateMigrationJournal(options.migrationsDirectory);
  const client = postgres(getDatabaseUrl(options.databaseUrl), {
    max: 1,
    prepare: false,
  });
  try {
    await migrate(drizzle(client), { migrationsFolder: options.migrationsDirectory });
  } finally {
    await client.end();
  }
}
