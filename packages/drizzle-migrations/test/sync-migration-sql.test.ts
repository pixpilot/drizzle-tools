import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { syncMigrationSql } from '../src/sync-migration-sql';

const files = vi.hoisted(() => ({
  contents: new Map<string, string>(),
  validate: vi.fn(),
}));
vi.mock('node:fs', () => ({
  readdirSync: () => [...files.contents.keys()].map((file) => path.basename(file)),
  readFileSync: (file: string) => files.contents.get(file),
  writeFileSync: (file: string, sql: string) => files.contents.set(file, sql),
}));
vi.mock('../src/validate-migration-journal', () => ({
  validateMigrationJournal: files.validate,
}));
const directory = path.resolve('migrations');
const destination = path.join(directory, '0001_projection.sql');
const options = {
  migrationsDirectory: directory,
  name: 'projection',
  sql: 'select 1;\r\n',
};
beforeEach(() => {
  vi.resetAllMocks();
  files.contents.clear();
  files.contents.set(
    destination,
    '-- Custom SQL migration file, put your code below! --',
  );
});
describe('syncMigrationSql', () => {
  it('should fill the generated migration and accept repeated identical SQL', () => {
    expect(syncMigrationSql(options)).toBe('0001_projection.sql');
    expect(files.contents.get(destination)).toBe('select 1;\n');
    expect(syncMigrationSql(options)).toBe('0001_projection.sql');
  });
  it('should select the latest generated migration with the exact name', () => {
    const latest = path.join(directory, '0002_projection.sql');
    files.contents.set(latest, '');
    syncMigrationSql(options);
    expect(files.contents.get(latest)).toBe('select 1;\n');
    expect(files.contents.get(destination)).toContain('Custom SQL');
  });
  it('should never overwrite an existing migration', () => {
    files.contents.set(destination, 'select 2;');
    expect(() => syncMigrationSql(options)).toThrow('already has content');
    expect(files.contents.get(destination)).toBe('select 2;');
  });
  it('should require a generated migration', () => {
    files.contents.clear();
    expect(() => syncMigrationSql(options)).toThrow('generate --custom');
  });
  it.each(['../outside', '', 'nested/path'])(
    'should reject an unsafe name: %s',
    (name) => {
      expect(() => syncMigrationSql({ ...options, name })).toThrow('Migration name');
    },
  );
  it('should reject empty source SQL', () => {
    expect(() => syncMigrationSql({ ...options, sql: ' ' })).toThrow('must not be empty');
  });
});
