# @pixpilot/drizzle-migrations

Reusable PostgreSQL migration CLI and Node utilities. Requires Node 20.19+ and `drizzle-orm >=0.45.2 <0.46.0`.

```sh
pnpm add -D @pixpilot/drizzle-migrations
pnpm add drizzle-orm
pnpm exec drizzle-migrations validate --migrations ./migrations
pnpm exec drizzle-migrations migrate --env-file ../../.env.local --env-file ../../.env
```

The root export contains types only. Node APIs are available from `@pixpilot/drizzle-migrations/server`.

```ts
import { runMigrations } from '@pixpilot/drizzle-migrations/server';

await runMigrations({ databaseUrl, migrationsDirectory });
```

See [CLI and integration](docs/integration.md) for configuration, custom SQL, and migration ownership.
