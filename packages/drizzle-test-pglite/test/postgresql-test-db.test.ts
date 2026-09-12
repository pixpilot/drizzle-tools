import { describe, expect, it } from 'vitest';

import { createPostgresqlTestDb } from '../src';

describe('createPostgresqlTestDb', () => {
  it('should be exported', () => {
    expect(createPostgresqlTestDb).toBeDefined();
  });
});
