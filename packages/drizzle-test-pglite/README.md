# drizzle-test-pglite

Fast, isolated PostgreSQL databases for Drizzle ORM tests, backed by
[PGlite](https://pglite.dev). Your schema is pushed once into an in-memory
Postgres, dumped to a cached snapshot, and reloaded per worker — so each test
gets a clean database without a Docker container or a migration run.

## Installation

```sh
pnpm add -D @pixpilot/drizzle-test-pglite
```

This package declares peer dependencies you must install alongside it:

| Peer                   | Range      |
| ---------------------- | ---------- |
| `drizzle-orm`          | `^0.45.2`  |
| `drizzle-kit`          | `^0.31.10` |
| `@electric-sql/pglite` | `^0.5.8`   |

## Usage

Create the factory once and share it across test files:

```ts
// test/db.ts
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import { fileURLToPath } from 'node:url';
import { createPostgresqlTestDb } from '@pixpilot/drizzle-test-pglite';
import * as schema from '../src/schema';

const schemaDir = fileURLToPath(new URL('../src/schema', import.meta.url));

export const { createTestDb } = createPostgresqlTestDb<PgliteDatabase<typeof schema>>({
  schema,
  cache: {
    directory: fileURLToPath(new URL('../node_modules/.cache/pglite', import.meta.url)),
    key: 'app',
    watchedPaths: [schemaDir],
  },
});
```

The explicit type argument is required. It is only inferable from `createDb`,
so without it the returned database widens to `{ $client: PGlite }` and every
query method disappears.

Then check out a database per test:

```ts
// test/users.test.ts
import { afterEach, beforeEach, expect, it } from 'vitest';
import { users } from '../src/schema';
import { createTestDb } from './db';

let db: Awaited<ReturnType<typeof createTestDb>>;

beforeEach(async () => {
  db = await createTestDb();
});

afterEach(async () => {
  await db.$client.close();
});

it('inserts a user', async () => {
  await db.insert(users).values({ name: 'Ada' });

  expect(await db.select().from(users)).toHaveLength(1);
});
```

## How it works

1. **Template build (once per cache key).** A fresh PGlite instance is created,
   `beforePush` runs, `drizzle-kit`'s `pushSchema` generates the DDL for your
   schema, and each statement is executed. The data directory is then dumped to
   `<cache.directory>/<cache.key>-<hash>.bin`.
2. **Cache key.** `<hash>` is the first 16 hex characters of a SHA-256 over the
   path and contents of every file under `cache.watchedPaths`, walked
   recursively and sorted. Edit your schema and the next run rebuilds
   automatically; nothing else invalidates the cache.
3. **Per-worker reuse.** Each test worker loads the snapshot into a single
   PGlite instance and keeps it. `createTestDb()` `TRUNCATE`s every table
   (`RESTART IDENTITY CASCADE`) and hands back the same Drizzle client, so a
   test starts from an empty schema without paying for schema creation again.

Parallel processes that miss the cache coordinate through a `.lock` directory
next to the snapshot: one builds, the rest poll for the finished file for up to
30 seconds. The snapshot is written to a temporary file and renamed, so a
crashed build never leaves a partial cache entry.

## API

### `createPostgresqlTestDb(options)`

Returns `{ createTestDb }`. Call `createTestDb()` to check out the worker's
database; call `db.$client.close()` to release it.

| Option                   | Type                                      | Default                       | Description                                                                                                   |
| ------------------------ | ----------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `schema`                 | `Record<string, unknown>`                 | —                             | Your Drizzle schema module (`import * as schema`).                                                            |
| `cache.directory`        | `string`                                  | —                             | Where snapshots are written. Created if missing; should be gitignored.                                        |
| `cache.key`              | `string`                                  | —                             | Filename prefix. Use distinct keys for distinct schemas sharing a directory.                                  |
| `cache.watchedPaths`     | `readonly string[]`                       | —                             | Files and directories whose contents invalidate the snapshot. Must exist; relative paths resolve against cwd. |
| `pushSchemas`            | `readonly string[]`                       | `['public']`                  | Postgres schemas passed to `pushSchema` as schema filters.                                                    |
| `resetSchemas`           | `readonly string[]`                       | `['public']`                  | Schemas whose tables are truncated between checkouts.                                                         |
| `resetTables`            | `readonly string[]`                       | `[]`                          | Extra qualified table names (`"auth.users"`) to truncate, for tables outside `resetSchemas`.                  |
| `beforePush`             | `(client: PGlite) => Promise<void>`       | —                             | Runs against the template before the schema push — create extensions, roles, or non-public schemas here.      |
| `shouldExecuteStatement` | `(statement: string) => boolean`          | —                             | Return `false` to skip a generated DDL statement. Every statement runs by default.                            |
| `checkoutErrorMessage`   | `string`                                  | built-in message              | Overrides the error thrown when a database is already checked out.                                            |
| `createDb`               | `(client: PGlite, schema: Schema) => TDb` | `drizzle(client, { schema })` | Build the Drizzle client yourself — for a custom logger, casing, or relational config.                        |

### Non-public schemas

`pushSchema` will not create schemas for you, so make them first:

```ts
createPostgresqlTestDb<PgliteDatabase<typeof schema>>({
  schema,
  pushSchemas: ['public', 'auth'],
  resetSchemas: ['public', 'auth'],
  beforePush: async (client) => {
    await client.exec('CREATE SCHEMA IF NOT EXISTS auth;');
  },
  cache: { directory: cacheDir, key: 'app', watchedPaths: [schemaDir] },
});
```

## Caveats

- **One database per worker.** `createTestDb()` throws if the previous one was
  not closed. Do not use `test.concurrent` or `describe.concurrent` with it —
  run tests inside a file sequentially and let your runner parallelize by file.
- **`close()` does not close.** It releases the checkout so the next test can
  take the instance; the underlying PGlite process stays alive for the worker.
- **The truncation list is fixed at load time.** It is derived from the
  snapshot's `pg_tables`, so a table a test creates at runtime is not truncated
  afterwards. Create it in `beforePush` instead, or list it in `resetTables`.
- **Only `watchedPaths` invalidates the cache.** Changing `beforePush`,
  `shouldExecuteStatement`, or `pushSchemas` will not rebuild the snapshot on
  its own — bump `cache.key` or delete the cache directory.
- **PGlite is not Postgres.** It is a real Postgres build compiled to WASM,
  single-connection and single-user. Extensions must be PGlite builds, and
  anything depending on real concurrency or replication will not behave the same.
