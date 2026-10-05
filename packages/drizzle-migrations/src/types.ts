export interface MigrationOptions {
  databaseUrl: string;
  migrationsDirectory: string;
}

export interface SyncMigrationSqlOptions {
  migrationsDirectory: string;
  name: string;
  sql: string;
}
