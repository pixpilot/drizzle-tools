import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const MIGRATION_INDEX_WIDTH = 4;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Check that every SQL file is journaled, ordered, and has its generated snapshot. */
export function validateMigrationJournal(migrationsDirectory: string): void {
  const journalPath = path.join(migrationsDirectory, 'meta/_journal.json');
  if (!existsSync(journalPath)) {
    throw new Error('No migration journal found. Run pnpm db:generate first.');
  }
  const journal: unknown = JSON.parse(readFileSync(journalPath, 'utf8'));
  if (
    typeof journal !== 'object' ||
    journal === null ||
    !('entries' in journal) ||
    !Array.isArray(journal.entries)
  ) {
    throw new TypeError('Migration journal must contain an entries array.');
  }
  const files = new Set(
    readdirSync(migrationsDirectory).filter((file) => file.endsWith('.sql')),
  );
  const tags = new Set<string>();
  let previousTimestamp = -Infinity;
  const { entries } = journal;
  for (const [index, entry] of entries.entries()) {
    if (!isRecord(entry)) {
      throw new Error(`Invalid migration journal entry ${index}.`);
    }
    const { idx, tag, when } = entry;
    if (
      idx !== index ||
      typeof tag !== 'string' ||
      !/^\d{4}_[\w-]+$/u.test(tag) ||
      typeof when !== 'number' ||
      !Number.isFinite(when) ||
      when <= previousTimestamp
    ) {
      throw new Error(`Invalid or unordered migration journal entry ${index}.`);
    }
    if (tags.has(tag) || !files.delete(`${tag}.sql`)) {
      throw new Error(`Duplicate or missing migration: ${tag}.sql`);
    }
    const snapshot = `${String(idx).padStart(MIGRATION_INDEX_WIDTH, '0')}_snapshot.json`;
    if (!existsSync(path.join(migrationsDirectory, 'meta', snapshot))) {
      throw new Error(`Missing generated migration snapshot: ${snapshot}`);
    }
    tags.add(tag);
    previousTimestamp = when;
  }
  if (files.size > 0) {
    throw new Error(`Unjournaled migration files: ${[...files].join(', ')}`);
  }
}
