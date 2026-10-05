import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { loadEnvFiles } from '@pixpilot/env/node';
import { getDatabaseUrl } from './get-database-url';
import { runMigrations } from './run-migrations';
import { syncMigrationSql } from './sync-migration-sql';
import { validateMigrationJournal } from './validate-migration-journal';

const HELP = `Usage: drizzle-migrations <command> [options]

Commands:
  validate                 Validate migration SQL, snapshots, and journal
  migrate                  Validate and apply pending PostgreSQL migrations
  sync --name NAME --source FILE
                           Fill a generated custom migration from a SQL file

Options:
  --migrations DIR         Migration directory (default: ./migrations)
  --url URL                Connection URL (default: DATABASE_URL)
  --env-file FILE          Load an env file; repeat in precedence order
  --help, -h               Show this help

Paths are relative to the current working directory. Shell variables take precedence.`;

function writeOutput(message: string): void {
  process.stdout.write(`${message}\n`);
}

/** Run the migration CLI with explicit arguments; imports never execute commands. */
export async function runCli(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      help: { type: 'boolean', short: 'h' },
      migrations: { type: 'string', default: './migrations' },
      url: { type: 'string' },
      'env-file': { type: 'string', multiple: true },
      name: { type: 'string' },
      source: { type: 'string' },
    },
  });
  if (values.help || positionals.length === 0) {
    writeOutput(HELP);
    return;
  }
  if (positionals.length !== 1) {
    throw new Error('Expected one command. Run drizzle-migrations --help.');
  }
  const directory = resolve(values.migrations);
  const command = positionals[0];
  if (command === undefined) throw new Error('Expected one command.');
  switch (command) {
    case 'validate':
      validateMigrationJournal(directory);
      writeOutput('Migration journal validation passed.');
      break;
    case 'migrate':
      loadEnvFiles({ files: values['env-file'] ?? [] });
      await runMigrations({
        databaseUrl: getDatabaseUrl(values.url ?? process.env['DATABASE_URL']),
        migrationsDirectory: directory,
      });
      writeOutput('Migrations applied.');
      break;
    case 'sync': {
      if (values.name === undefined || values.source === undefined) {
        throw new Error('sync requires --name and --source.');
      }
      const file = syncMigrationSql({
        migrationsDirectory: directory,
        name: values.name,
        sql: readFileSync(resolve(values.source), 'utf8'),
      });
      writeOutput(`SQL synced into ${file}.`);
      break;
    }
    default:
      throw new Error(
        `Unknown command: ${positionals[0]}. Run drizzle-migrations --help.`,
      );
  }
}
