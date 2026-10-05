import path from 'node:path';
import process from 'node:process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCli } from '../src/run-cli';

const operations = vi.hoisted(() => ({
  migrate: vi.fn(async () => {}),
  validate: vi.fn(),
  load: vi.fn(),
}));
vi.mock('../src/run-migrations', () => ({ runMigrations: operations.migrate }));
vi.mock('../src/validate-migration-journal', () => ({
  validateMigrationJournal: operations.validate,
}));
vi.mock('@pixpilot/env/node', () => ({ loadEnvFiles: operations.load }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@remote.example.com/db');
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
describe('migration CLI', () => {
  it('should show help without migrating', async () => {
    await runCli(['--help']);
    expect(process.stdout.write).toHaveBeenCalledWith(
      expect.stringContaining('Usage: drizzle-migrations'),
    );
    expect(operations.migrate).not.toHaveBeenCalled();
  });
  it('should resolve an explicit migration directory for validation', async () => {
    await runCli(['validate', '--migrations', './custom']);
    expect(operations.validate).toHaveBeenCalledWith(path.resolve('./custom'));
  });
  it('should load explicit env files and prefer an explicit URL', async () => {
    const url = 'postgresql://user:pass@another.example.com/db';
    await runCli([
      'migrate',
      '--url',
      url,
      '--env-file',
      '../../.env.local',
      '--env-file',
      '../../.env',
    ]);
    expect(operations.load).toHaveBeenCalledWith({
      files: ['../../.env.local', '../../.env'],
    });
    expect(operations.migrate).toHaveBeenCalledWith({
      databaseUrl: url,
      migrationsDirectory: path.resolve('migrations'),
    });
  });
  it('should use DATABASE_URL when no URL argument is supplied', async () => {
    await runCli(['migrate']);
    expect(operations.migrate).toHaveBeenCalledWith(
      expect.objectContaining({
        databaseUrl: 'postgresql://user:pass@remote.example.com/db',
      }),
    );
  });
  it.each([['unknown'], ['validate', 'extra'], ['migrate', '--typo'], ['sync']])(
    'should reject invalid arguments: %j',
    async (...args) => {
      await expect(runCli(args)).rejects.toThrow();
    },
  );
});
