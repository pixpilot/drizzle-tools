import { describe, expect, it } from 'vitest';
import { getDatabaseUrl } from '../src/get-database-url';

describe('getDatabaseUrl', () => {
  it.each(['postgres://user:pass@localhost/db', 'postgresql://user:pass@localhost/db'])(
    'should accept a PostgreSQL URL: %s',
    (url) => expect(getDatabaseUrl(url)).toBe(url),
  );
  it.each([
    undefined,
    '',
    ' ',
    'invalid',
    'https://example.com/db',
    'postgres://user@localhost',
  ])('should reject missing or invalid credentials: %s', (url) =>
    expect(() => getDatabaseUrl(url)).toThrow(),
  );
});
