/* eslint-disable no-await-in-loop */
/* eslint-disable no-continue */
import type { PGlite } from '@electric-sql/pglite';

import { Buffer } from 'node:buffer';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite as PGliteClient } from '@electric-sql/pglite';
import { pushSchema } from 'drizzle-kit/api';
import { drizzle } from 'drizzle-orm/pglite';

type Schema = Record<string, unknown>;
type TestDb<TDb> = TDb & { $client: PGlite };
const schemaHashLength = 16;
const snapshotWaitAttempts = 300;
const snapshotWaitMs = 100;

export interface PostgresqlTestDbCacheOptions {
  directory: string;
  key: string;
  watchedPaths: readonly string[];
}

export interface PostgresqlTestDbOptions<TDb> {
  schema: Schema;
  cache: PostgresqlTestDbCacheOptions;
  pushSchemas?: readonly string[];
  resetSchemas?: readonly string[];
  resetTables?: readonly string[];
  beforePush?: (client: PGlite) => Promise<void>;
  shouldExecuteStatement?: (statement: string) => boolean;
  checkoutErrorMessage?: string;
  createDb?: (client: PGlite, schema: Schema) => TDb;
}

interface WorkerDbState<TDb> {
  client: PGlite;
  db: TestDb<TDb>;
  resetSql: string;
  checkedOut: boolean;
}

interface PostgresqlTestDbFactory<TDb> {
  createTestDb: () => Promise<TestDb<TDb>>;
}

async function sleep(ms: number): Promise<void> {
  await new Promise<void>((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function quoteQualifiedName(name: string): string {
  return name.split('.').map(quoteIdentifier).join('.');
}

async function getFiles(paths: readonly string[]): Promise<string[]> {
  const files: string[] = [];

  for (const path of paths) {
    const pathStat = await stat(path);
    if (pathStat.isDirectory()) {
      const entries = await readdir(path, { withFileTypes: true });
      for (const entry of entries) {
        files.push(...(await getFiles([resolve(path, entry.name)])));
      }
      continue;
    }

    if (pathStat.isFile()) files.push(path);
  }

  return files.sort();
}

async function getSnapshotCachePath(
  cache: PostgresqlTestDbCacheOptions,
): Promise<string> {
  const hash = createHash('sha256');
  const watchedFiles = await getFiles(cache.watchedPaths);

  for (const filePath of watchedFiles) {
    hash.update(filePath);
    hash.update(await readFile(filePath));
  }

  return resolve(
    cache.directory,
    `${cache.key}-${hash.digest('hex').slice(0, schemaHashLength)}.bin`,
  );
}

async function readSnapshotFromCache(cachePath: string): Promise<Blob | undefined> {
  if (!existsSync(cachePath)) return undefined;

  return new Blob([await readFile(cachePath)]);
}

async function waitForCachedSnapshot(cachePath: string): Promise<Blob> {
  for (let attempt = 0; attempt < snapshotWaitAttempts; attempt += 1) {
    const snapshot = await readSnapshotFromCache(cachePath);
    if (snapshot) return snapshot;
    await sleep(snapshotWaitMs);
  }

  throw new Error(
    `Timed out waiting for cached PostgreSQL test DB snapshot: ${cachePath}`,
  );
}

async function withSnapshotBuildLock(
  cachePath: string,
  build: () => Promise<Blob | File>,
): Promise<Blob | File> {
  const lockPath = `${cachePath}.lock`;

  try {
    await mkdir(lockPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;

    return waitForCachedSnapshot(cachePath);
  }

  try {
    const cachedSnapshot = await readSnapshotFromCache(cachePath);
    if (cachedSnapshot) return cachedSnapshot;

    return await build();
  } finally {
    await rm(lockPath, { force: true, recursive: true });
  }
}

async function buildTemplateSnapshot<TDb>(
  options: PostgresqlTestDbOptions<TDb>,
): Promise<Blob | File> {
  const client = new PGliteClient();
  await options.beforePush?.(client);

  const db = drizzle(client, { schema: options.schema });
  const { statementsToExecute } = await pushSchema(
    options.schema,
    db as unknown as Parameters<typeof pushSchema>[1],
    [...(options.pushSchemas ?? ['public'])],
  );

  for (const statement of statementsToExecute) {
    if (options.shouldExecuteStatement?.(statement) === false) continue;
    await client.exec(statement);
  }

  const snapshot = await client.dumpDataDir('none');
  await client.close();
  return snapshot;
}

async function getTemplateSnapshot<TDb>(
  options: PostgresqlTestDbOptions<TDb>,
): Promise<Blob | File> {
  const cachePath = await getSnapshotCachePath(options.cache);
  const cachedSnapshot = await readSnapshotFromCache(cachePath);
  if (cachedSnapshot) return cachedSnapshot;

  await mkdir(options.cache.directory, { recursive: true });

  return withSnapshotBuildLock(cachePath, async () => {
    const snapshot = await buildTemplateSnapshot(options);
    const tempCachePath = `${cachePath}.${randomUUID()}.tmp`;
    await writeFile(tempCachePath, Buffer.from(await snapshot.arrayBuffer()));
    await rename(tempCachePath, cachePath);
    return snapshot;
  });
}

async function buildResetSql<TDb>(
  client: PGlite,
  options: PostgresqlTestDbOptions<TDb>,
): Promise<string> {
  const schemas = options.resetSchemas ?? ['public'];
  const schemaList = schemas
    .map((schema) => `'${schema.replaceAll("'", "''")}'`)
    .join(', ');
  const result = await client.query<{ schemaname: string; tablename: string }>(`
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname IN (${schemaList})
    ORDER BY schemaname, tablename;
  `);

  const schemaTables = result.rows.map(
    ({ schemaname, tablename }) =>
      `${quoteIdentifier(schemaname)}.${quoteIdentifier(tablename)}`,
  );
  const resetTables = [
    ...schemaTables,
    ...(options.resetTables ?? []).map(quoteQualifiedName),
  ];

  if (resetTables.length === 0) return '';

  return `TRUNCATE TABLE ${resetTables.join(', ')} RESTART IDENTITY CASCADE;`;
}

export function createPostgresqlTestDb<TDb>(
  options: PostgresqlTestDbOptions<TDb>,
): PostgresqlTestDbFactory<TDb> {
  let templateSnapshot: Promise<Blob | File> | undefined;
  let workerDbState: Promise<WorkerDbState<TDb>> | undefined;

  async function getWorkerDbState(): Promise<WorkerDbState<TDb>> {
    if (workerDbState) return workerDbState;

    workerDbState = (async () => {
      templateSnapshot ??= getTemplateSnapshot(options);
      const client = new PGliteClient({ loadDataDir: await templateSnapshot });
      const db = (options.createDb?.(client, options.schema) ??
        drizzle(client, { schema: options.schema })) as TestDb<TDb>;
      db.$client = client;

      return {
        checkedOut: false,
        client,
        db,
        resetSql: await buildResetSql(client, options),
      };
    })();

    return workerDbState;
  }

  return {
    async createTestDb(): Promise<TestDb<TDb>> {
      const state = await getWorkerDbState();

      if (state.checkedOut) {
        throw new Error(
          options.checkoutErrorMessage ??
            'PostgreSQL test DB is already checked out in this worker. Use createTestDb only from non-concurrent tests or close it before creating another database.',
        );
      }

      if (state.resetSql) await state.client.exec(state.resetSql);
      state.checkedOut = true;
      state.db.$client.close = async () => {
        state.checkedOut = false;
      };

      return state.db;
    },
  };
}
