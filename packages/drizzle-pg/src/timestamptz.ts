import { timestamp } from 'drizzle-orm/pg-core';

type TimestampConfig = Record<string, unknown>;


/**
 * `timestamp` that always carries a timezone.
 *
 * Every package writes timestamps from a different place — CI runners, edge
 * workers, webhooks — so a naive timestamp would silently reorder history.
 * Declaring one helper here keeps that guarantee identical everywhere instead
 * of leaving each schema package to re-derive it.
 */
export const timestamptz = ((
  nameOrConfig?: string | TimestampConfig,
  config?: TimestampConfig,
) => {
  if (typeof nameOrConfig === 'string') {
    return timestamp(nameOrConfig, {
      ...(config ?? {}),
      withTimezone: true,
    });
  }

  return timestamp({
    ...(nameOrConfig ?? {}),
    withTimezone: true,
  });
}) as typeof timestamp;
