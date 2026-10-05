/** Validate an explicitly supplied PostgreSQL connection URL. */
export function getDatabaseUrl(value: string | undefined): string {
  if (value === undefined || value.trim() === '') {
    throw new Error('Set DATABASE_URL or supply --url before connecting.');
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('DATABASE_URL must be a Postgres connection URL.');
  }
  if (
    (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') ||
    url.hostname === '' ||
    url.pathname.slice(1) === ''
  ) {
    throw new Error(
      'DATABASE_URL must be a Postgres connection URL with a host and database.',
    );
  }
  return value;
}
