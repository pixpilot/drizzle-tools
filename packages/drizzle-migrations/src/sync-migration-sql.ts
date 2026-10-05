import type { SyncMigrationSqlOptions } from './types';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { validateMigrationJournal } from './validate-migration-journal';

/** Fill a generated custom migration without overwriting existing SQL. */
export function syncMigrationSql(options: SyncMigrationSqlOptions): string {
  const { migrationsDirectory, name, sql } = options;
  if (!/^[\w-]+$/u.test(name)) {
    throw new Error(
      'Migration name must contain only letters, numbers, underscores, or hyphens.',
    );
  }
  validateMigrationJournal(migrationsDirectory);
  const file = readdirSync(migrationsDirectory)
    .filter((entry) => entry.endsWith(`_${name}.sql`))
    .sort()
    .at(-1);
  if (file === undefined) {
    throw new Error(`Run drizzle-kit generate --custom --name ${name} first.`);
  }
  const destination = path.join(migrationsDirectory, file);
  const existing = readFileSync(destination, 'utf8').replaceAll('\r\n', '\n').trim();
  const contents = sql.replaceAll('\r\n', '\n').trim();
  if (contents === '') {
    throw new Error('Source SQL must not be empty.');
  }
  if (existing !== contents) {
    if (
      existing !== '-- Custom SQL migration file, put your code below! --' &&
      existing !== ''
    ) {
      throw new Error(
        `${file} already has content. Generate a new custom migration before syncing updated SQL.`,
      );
    }
    writeFileSync(destination, `${contents}\n`);
  }
  return file;
}
