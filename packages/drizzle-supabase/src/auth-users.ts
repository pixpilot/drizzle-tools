import { pgSchema, uuid } from 'drizzle-orm/pg-core';

const auth = pgSchema('auth');

/**
 * Supabase's `auth.users`, modelled as a foreign-key target and nothing else.
 *
 * Supabase owns this table, so nothing here is ever migrated. It carries only
 * `id` on purpose: the runtime database role has no `USAGE` on the `auth`
 * schema, which makes every column but this one unreachable in production —
 * a foreign key onto `auth.users(id)` needs no grant, a `select` does. Modelling
 * `email` or `banned_until` here would let application code compile a query
 * that can only fail once deployed.
 *
 * Account state the server needs lives in app-owned `public` projections kept
 * in sync by Auth triggers (`user_account_status`, `user_directory`). See
 * `packages/database/SUPABASE_AUTH_USER_DATA.md` and
 * https://supabase.com/docs/guides/auth/managing-user-data
 */
export const authUsers = auth.table('users', {
  id: uuid('id').primaryKey(),
});
