import type { PGlite } from '@electric-sql/pglite';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { citext } from '@electric-sql/pglite/contrib/citext';
import { eq, sql } from 'drizzle-orm';
import { customType, integer, pgTable } from 'drizzle-orm/pg-core';
import { afterAll, afterEach, describe, expect, it } from 'vitest';

import { createPostgresqlTestDb } from '../src';

const ciText = customType<{ data: string }>({ dataType: () => 'citext' });

const accounts = pgTable('accounts', {
  id: integer('id').primaryKey(),
  email: ciText('email').notNull(),
}).enableRLS();

const schema = { accounts };
const migrationsFolder = fileURLToPath(new URL('fixtures/migrations', import.meta.url));
const cacheDirectory = join(tmpdir(), `drizzle-test-pglite-${randomUUID()}`);

afterAll(async () => {
  await rm(cacheDirectory, { force: true, recursive: true });
});

describe.each([
  {
    mode: 'schema-push',
    build: {
      beforePush: async (client: PGlite) => {
        await client.exec('CREATE EXTENSION IF NOT EXISTS citext;');
      },
    },
  },
  { mode: 'migrations', build: { migrationsFolder } },
])('createPostgresqlTestDb with an extension ($mode)', ({ mode, build }) => {
  const { createTestDb } = createPostgresqlTestDb<PgliteDatabase<typeof schema>>({
    schema,
    pgliteOptions: { extensions: { citext } },
    cache: { directory: cacheDirectory, key: mode, watchedPaths: [migrationsFolder] },
    ...build,
  });

  let db: Awaited<ReturnType<typeof createTestDb>>;

  afterEach(async () => {
    await db.$client.close();
  });

  it('loads the extension in the template and the worker database', async () => {
    db = await createTestDb();
    await db.insert(accounts).values({ id: 1, email: 'Ada@Example.com' });

    const rows = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.email, 'ada@example.com'));

    expect(rows).toEqual([{ id: 1 }]);
  });

  it('starts each checkout from empty tables', async () => {
    db = await createTestDb();
    const { rows } = await db.execute<{ count: number }>(
      sql`select count(*)::int as count from accounts`,
    );

    expect(rows).toEqual([{ count: 0 }]);
  });
});
