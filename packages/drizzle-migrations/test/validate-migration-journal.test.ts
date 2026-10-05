import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validateMigrationJournal } from '../src/validate-migration-journal';

const files = vi.hoisted(() => ({ contents: new Map<string, string>() }));
vi.mock('node:fs', () => ({
  existsSync: (file: string) => files.contents.has(file),
  readFileSync: (file: string) => files.contents.get(file),
  readdirSync: () =>
    [...files.contents.keys()]
      .filter((file) => file.endsWith('.sql'))
      .map((file) => path.basename(file)),
}));

const directory = path.resolve('migrations');
const journalPath = path.join(directory, 'meta/_journal.json');

beforeEach(() => {
  files.contents.clear();
  files.contents.set(
    journalPath,
    JSON.stringify({
      entries: [
        { idx: 0, tag: '0000_initial', when: 1 },
        { idx: 1, tag: '0001_update', when: 2 },
      ],
    }),
  );
  for (const name of [
    '0000_initial.sql',
    '0001_update.sql',
    'meta/0000_snapshot.json',
    'meta/0001_snapshot.json',
  ]) {
    files.contents.set(path.join(directory, name), '');
  }
});

describe('validateMigrationJournal', () => {
  it('should accept an ordered journal with SQL and snapshots', () => {
    expect(() => validateMigrationJournal(directory)).not.toThrow();
  });

  it('should explain how to initialize migrations', () => {
    files.contents.delete(journalPath);
    expect(() => validateMigrationJournal(directory)).toThrow('Run pnpm db:generate');
  });

  it('should reject SQL that Drizzle would silently skip', () => {
    files.contents.set(path.join(directory, '0002_orphan.sql'), '');
    expect(() => validateMigrationJournal(directory)).toThrow(
      'Unjournaled migration files',
    );
  });

  it.each(['0000_initial.sql', 'meta/0001_snapshot.json'])(
    'should reject a missing generated file: %s',
    (file) => {
      files.contents.delete(path.join(directory, file));
      expect(() => validateMigrationJournal(directory)).toThrow(/missing/iu);
    },
  );

  it.each([
    {
      entries: [
        { idx: 0, tag: '0000_initial', when: 2 },
        { idx: 1, tag: '0001_update', when: 1 },
      ],
    },
    { entries: [{ idx: 1, tag: '0000_initial', when: 1 }] },
    {
      entries: [
        { idx: 0, tag: '0000_initial', when: 1 },
        { idx: 1, tag: '0000_initial', when: 2 },
      ],
    },
    { entries: [null] },
    { entries: [{ idx: 0, tag: '../outside', when: 1 }] },
    {},
  ])('should reject malformed or unordered history: %j', (journal) => {
    files.contents.set(journalPath, JSON.stringify(journal));
    expect(() => validateMigrationJournal(directory)).toThrow();
  });
});
