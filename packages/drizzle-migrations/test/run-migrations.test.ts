import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runMigrations } from '../src/run-migrations';

const database = vi.hoisted(() => ({
  end: vi.fn(async () => {}),
  migrate: vi.fn(async () => {}),
  validate: vi.fn((_directory: string) => {}),
  connect: vi.fn(),
}));
vi.mock('postgres', () => ({ default: database.connect }));
vi.mock('drizzle-orm/postgres-js', () => ({ drizzle: (client: object) => client }));
vi.mock('drizzle-orm/postgres-js/migrator', () => ({ migrate: database.migrate }));
vi.mock('../src/validate-migration-journal', () => ({
  validateMigrationJournal: database.validate,
}));
const options = {
  databaseUrl: 'postgresql://postgres:password@remote.example.com/postgres',
  migrationsDirectory: '/app/migrations',
};
beforeEach(() => {
  vi.resetAllMocks();
  database.connect.mockReturnValue({ end: database.end });
});
describe('runMigrations', () => {
  it('should validate and migrate using the supplied target and close the connection', async () => {
    await runMigrations(options);
    expect(database.validate).toHaveBeenCalledExactlyOnceWith(
      options.migrationsDirectory,
    );
    expect(database.connect).toHaveBeenCalledExactlyOnceWith(options.databaseUrl, {
      max: 1,
      prepare: false,
    });
    expect(database.migrate).toHaveBeenCalledExactlyOnceWith(
      { end: database.end },
      { migrationsFolder: options.migrationsDirectory },
    );
    expect(database.end).toHaveBeenCalledOnce();
  });
  it('should reject invalid history before connecting', async () => {
    database.validate.mockImplementationOnce(() => {
      throw new Error('Invalid journal');
    });
    await expect(runMigrations(options)).rejects.toThrow('Invalid journal');
    expect(database.connect).not.toHaveBeenCalled();
  });
  it('should close the connection and propagate a migration failure', async () => {
    database.migrate.mockRejectedValueOnce(new Error('Migration failed'));
    await expect(runMigrations(options)).rejects.toThrow('Migration failed');
    expect(database.end).toHaveBeenCalledOnce();
  });
});
