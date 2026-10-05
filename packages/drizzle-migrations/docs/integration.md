# CLI and integration

The consuming application owns schemas, generated SQL, snapshots, the migration journal, credentials, and environment files. This package has no schema or app-specific SQL.

## Commands

Run commands from the directory containing your migrations, or pass `--migrations DIR`. Every relative path is resolved from the current working directory.

- `drizzle-migrations validate`: check ordered journal entries, SQL files, and generated snapshots.
- `drizzle-migrations migrate`: validate history, apply pending migrations, and close the PostgreSQL connection.
- `drizzle-migrations sync --name NAME --source FILE`: fill the latest custom migration generated for NAME.
- `drizzle-migrations --help`: list commands and options.

Generate and review migrations with the consuming app's installed `drizzle-kit` before applying them. This validator targets the Drizzle Kit 0.31 journal and snapshot format; check compatibility before upgrading.

## Connection and environment

`migrate` uses `--url URL`, or `DATABASE_URL` when the option is omitted. Environment files load only when explicitly supplied using repeatable `--env-file` options. Existing shell/CI variables take precedence, then the first file, then later files. Use environment variables to keep credentials out of command history.

For Stackforge's database package:

```sh
drizzle-migrations migrate --env-file ../../.env.local --env-file ../../.env
```

Use a direct PostgreSQL or session-pooler connection with migration permissions.

## Custom SQL

Generate a custom migration first:

```sh
drizzle-kit generate --custom --name user_account_status_projection
drizzle-migrations sync --name user_account_status_projection --source ./projection.sql
```

Sync validates the journal and fills only an empty migration or Drizzle's placeholder. Identical SQL is accepted on repeat runs. Existing different SQL is never overwritten; generate a new custom migration for updates. No SQL or journal files are created by this command.

For SQL supplied by another package, keep a small app adapter:

```ts
import { syncMigrationSql } from '@pixpilot/drizzle-migrations/server';

syncMigrationSql({ migrationsDirectory, name: 'user_account_status_projection', sql });
```

## Node API

`@pixpilot/drizzle-migrations/server` exports `runMigrations`, `validateMigrationJournal`, `syncMigrationSql`, `getDatabaseUrl(value)`. Environment parsing uses `loadEnvFiles` from `@pixpilot/env/node`. Imports never open connections or load environment files. Pass paths, SQL, and credentials explicitly.

## Local development before publishing

**Terminal: drizzle-tools repository root**

1. Run `pnpm --dir ../js-utils/packages/env build`.
2. Run `pnpm --dir ../js-utils/packages/env pack` to create the local tarball used by the env override.
3. Run `pnpm install`.
4. Run `pnpm --filter @pixpilot/drizzle-migrations build`.

Stackforge links this package from the sibling repository. Publish the pending env patch and both new CLI packages before distributing generated workspaces, then remove the local overrides and refresh the lockfiles.
