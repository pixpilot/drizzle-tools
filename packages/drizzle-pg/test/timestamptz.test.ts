import type { PgColumn } from 'drizzle-orm/pg-core';

import { getTableConfig, pgTable, timestamp } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import { timestamptz } from '../src';

const SAMPLE = new Date('2020-01-02T03:04:05.000Z');

function columnsOf(table: Parameters<typeof getTableConfig>[0]): Map<string, PgColumn> {
  return new Map(getTableConfig(table).columns.map((column) => [column.name, column]));
}

describe('timestamptz', () => {
  it('should produce a timestamp column that carries a timezone', () => {
    const table = pgTable('events', { at: timestamptz('at') });

    expect(columnsOf(table).get('at')?.getSQLType()).toBe('timestamp with time zone');
  });

  it('should differ from the plain drizzle timestamp it wraps', () => {
    const table = pgTable('events', {
      naive: timestamp('naive'),
      aware: timestamptz('aware'),
    });
    const columns = columnsOf(table);

    expect(columns.get('naive')?.getSQLType()).toBe('timestamp');
    expect(columns.get('aware')?.getSQLType()).toBe('timestamp with time zone');
  });

  it('should take its name from the object key when called with no arguments', () => {
    const table = pgTable('events', { createdAt: timestamptz() });
    const [column] = getTableConfig(table).columns;

    expect(column?.name).toBe('createdAt');
    expect(column?.getSQLType()).toBe('timestamp with time zone');
  });

  it('should accept a config object as its only argument', () => {
    const table = pgTable('events', { at: timestamptz({ mode: 'string' }) });
    const column = columnsOf(table).get('at');

    expect(column?.getSQLType()).toBe('timestamp with time zone');
    expect(column?.mapFromDriverValue(SAMPLE)).toBe('2020-01-02 03:04:05.000+00');
  });

  it('should accept a name and a config object', () => {
    const table = pgTable('events', { at: timestamptz('at', { precision: 3 }) });

    expect(columnsOf(table).get('at')?.getSQLType()).toBe('timestamp (3) with time zone');
  });

  it('should keep the config when only a name is given', () => {
    const table = pgTable('events', { at: timestamptz('at') });

    expect(columnsOf(table).get('at')?.mapFromDriverValue(SAMPLE)).toBeInstanceOf(Date);
  });

  it('should preserve precision alongside the timezone', () => {
    const table = pgTable('events', { at: timestamptz({ precision: 6 }) });

    expect(columnsOf(table).get('at')?.getSQLType()).toBe('timestamp (6) with time zone');
  });

  it('should preserve precision for the string-mode column class too', () => {
    // drizzle renders precision without a space in string mode; the helper
    // only adds the timezone, so both spellings must keep it.
    const table = pgTable('events', {
      at: timestamptz('at', { precision: 3, mode: 'string' }),
    });

    expect(columnsOf(table).get('at')?.getSQLType()).toBe('timestamp(3) with time zone');
  });

  it('should preserve mode: "date" mapping', () => {
    const table = pgTable('events', { at: timestamptz('at', { mode: 'date' }) });
    const mapped = columnsOf(table).get('at')?.mapFromDriverValue(SAMPLE);

    expect(mapped).toBeInstanceOf(Date);
    expect((mapped as Date).toISOString()).toBe('2020-01-02T03:04:05.000Z');
  });

  describe('withTimezone override', () => {
    it('should override an explicit withTimezone: false in the config-only form', () => {
      const table = pgTable('events', { at: timestamptz({ withTimezone: false }) });

      expect(columnsOf(table).get('at')?.getSQLType()).toBe('timestamp with time zone');
    });

    it('should override an explicit withTimezone: false in the named form', () => {
      const table = pgTable('events', {
        at: timestamptz('at', { withTimezone: false }),
      });

      expect(columnsOf(table).get('at')?.getSQLType()).toBe('timestamp with time zone');
    });

    it('should keep withTimezone: true when it is already set', () => {
      const table = pgTable('events', { at: timestamptz('at', { withTimezone: true }) });

      expect(columnsOf(table).get('at')?.getSQLType()).toBe('timestamp with time zone');
    });
  });

  describe('builder interoperability', () => {
    it('should still support the drizzle builder chain', () => {
      const table = pgTable('events', {
        at: timestamptz('at').notNull().defaultNow(),
      });
      const column = columnsOf(table).get('at');

      expect(column?.notNull).toBe(true);
      expect(column?.hasDefault).toBe(true);
      expect(column?.getSQLType()).toBe('timestamp with time zone');
    });

    it('should support a literal default', () => {
      const table = pgTable('events', { at: timestamptz('at').default(SAMPLE) });

      expect(columnsOf(table).get('at')?.default).toBe(SAMPLE);
    });

    it('should support being used as a primary key', () => {
      const table = pgTable('events', { at: timestamptz('at').primaryKey() });

      expect(columnsOf(table).get('at')?.primary).toBe(true);
    });

    it('should support an explicit database column name that differs from the key', () => {
      const table = pgTable('events', { createdAt: timestamptz('created_at') });

      expect(getTableConfig(table).columns[0]?.name).toBe('created_at');
    });
  });

  describe('input handling', () => {
    it('should not mutate the config object it is given', () => {
      const config = { precision: 3, withTimezone: false } as const;
      const snapshot = { ...config };

      pgTable('events', { at: timestamptz('at', config) });
      pgTable('events2', { at: timestamptz(config) });

      expect(config).toEqual(snapshot);
    });

    it('should produce independent columns from the same config object', () => {
      const config = { precision: 3 } as const;
      const table = pgTable('events', {
        a: timestamptz('a', config),
        b: timestamptz('b', config),
      });
      const columns = columnsOf(table);

      expect(columns.get('a')?.getSQLType()).toBe('timestamp (3) with time zone');
      expect(columns.get('b')?.getSQLType()).toBe('timestamp (3) with time zone');
    });
  });
});
