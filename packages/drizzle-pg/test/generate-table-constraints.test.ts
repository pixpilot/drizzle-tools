import type { AnyPgColumn } from 'drizzle-orm/pg-core';

import { getTableName } from 'drizzle-orm';
import { pgTable, text } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import { generateTableConstraints } from '../src';
import { buildTable, demoColumns } from './helpers';

const LOOSE_EMAIL_REGEX = "'^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'";
const STRICT_EMAIL_REGEX =
  "'^[a-zA-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$'";

describe('generateTableConstraints', () => {
  describe('table resolution', () => {
    it('should derive the table name from the columns it is given', () => {
      const { checkSql } = buildTable({ bio: { maxLength: 10 } }, 'accounts');

      expect(checkSql('accounts_bio_length_check')).toContain('"accounts"."bio"');
    });

    it('should throw when no column is available to resolve the table name', () => {
      expect(() => generateTableConstraints({}, {})).toThrow(
        'Unable to determine table name for constraint generation.',
      );
    });

    it('should use the database column name rather than the javascript field name', () => {
      const { indexNames, checkNames } = buildTable({
        name: { index: true, maxLength: 4 },
      });

      expect(indexNames).toEqual(['demo_display_name_idx']);
      expect(checkNames).toEqual(['demo_display_name_length_check']);
    });

    it('should resolve the table name from the first column regardless of key order', () => {
      const table = pgTable('legacy', { label: text('label') });
      const columns: Record<string, AnyPgColumn> = { label: table.label };

      expect(getTableName(table)).toBe('legacy');
      expect(generateTableConstraints(columns, { label: { maxLength: 1 } })).toHaveLength(
        1,
      );
    });
  });

  describe('config filtering', () => {
    it('should return an empty array when no fields are configured', () => {
      const { constraints, indexes, checks } = buildTable({});

      expect(constraints).toEqual([]);
      expect(indexes).toEqual([]);
      expect(checks).toEqual([]);
    });

    it('should skip fields whose config is undefined', () => {
      const { constraints } = buildTable({ bio: undefined, name: { index: true } });

      expect(constraints).toHaveLength(1);
    });

    it('should skip config entries that do not match a column', () => {
      const { constraints } = buildTable({
        nope: { index: true, maxLength: 3 },
        bio: { maxLength: 3 },
      });

      expect(constraints).toHaveLength(1);
    });

    it('should ignore a config object with no recognised keys', () => {
      const { constraints } = buildTable({ active: {} });

      expect(constraints).toEqual([]);
    });

    it('should ignore decimal precision and scale, which are column-level concerns', () => {
      const { constraints } = buildTable({ price: { precision: 10, scale: 2 } });

      expect(constraints).toEqual([]);
    });
  });

  describe('indexes', () => {
    it('should create a plain index when index is true', () => {
      const { indexes } = buildTable({ email: { index: true } });

      expect(indexes).toEqual([
        { name: 'demo_email_idx', unique: false, columns: ['email'] },
      ]);
    });

    it('should create a unique index when index is "unique"', () => {
      const { indexes } = buildTable({ email: { index: 'unique' } });

      expect(indexes).toEqual([
        { name: 'demo_email_unique', unique: true, columns: ['email'] },
      ]);
    });

    it('should not create an index when index is false', () => {
      const { indexes } = buildTable({ email: { index: false } });

      expect(indexes).toEqual([]);
    });

    it('should not create an index when index is omitted', () => {
      const { indexes } = buildTable({ email: { maxLength: 5 } });

      expect(indexes).toEqual([]);
    });

    it('should create one index per configured field', () => {
      const { indexNames } = buildTable({
        email: { index: 'unique' },
        status: { index: true },
      });

      expect(indexNames).toEqual(['demo_email_unique', 'demo_status_idx']);
    });
  });

  describe('string constraints', () => {
    it('should cap url columns at 2048 characters', () => {
      const { checkSql } = buildTable({ website: { urlLength: true } });

      expect(checkSql('demo_website_length_check')).toBe(
        '"demo"."website" IS NULL OR length("demo"."website") <= 2048',
      );
    });

    it('should prefer urlLength over an explicit min and max length', () => {
      const { checks } = buildTable({
        website: { urlLength: true, minLength: 1, maxLength: 10 },
      });

      expect(checks).toHaveLength(1);
      expect(checks[0]?.sql).toContain('<= 2048');
    });

    it('should fall through to min and max when urlLength is false', () => {
      const { checkSql } = buildTable({
        website: { urlLength: false, minLength: 1, maxLength: 10 },
      });

      expect(checkSql('demo_website_length_check')).toBe(
        '"demo"."website" IS NULL OR (length("demo"."website") >= 1 AND length("demo"."website") <= 10)',
      );
    });

    it('should emit a range check when both bounds are set', () => {
      const { checkSql } = buildTable({ bio: { minLength: 2, maxLength: 500 } });

      expect(checkSql('demo_bio_length_check')).toBe(
        '"demo"."bio" IS NULL OR (length("demo"."bio") >= 2 AND length("demo"."bio") <= 500)',
      );
    });

    it('should emit a lower-bound check when only minLength is set', () => {
      const { checkSql } = buildTable({ bio: { minLength: 3 } });

      expect(checkSql('demo_bio_length_check')).toBe(
        '"demo"."bio" IS NULL OR length("demo"."bio") >= 3',
      );
    });

    it('should emit an upper-bound check when only maxLength is set', () => {
      const { checkSql } = buildTable({ bio: { maxLength: 7 } });

      expect(checkSql('demo_bio_length_check')).toBe(
        '"demo"."bio" IS NULL OR length("demo"."bio") <= 7',
      );
    });

    it('should treat zero as a real bound rather than as absent', () => {
      const { checkSql } = buildTable({ bio: { minLength: 0 } });

      expect(checkSql('demo_bio_length_check')).toContain('>= 0');
    });

    it('should emit nothing when the length keys are present but undefined', () => {
      const { constraints } = buildTable({
        bio: { minLength: undefined, maxLength: undefined, urlLength: undefined },
      });

      expect(constraints).toEqual([]);
    });
  });

  describe('array constraints', () => {
    it('should cap the array length', () => {
      const { checkSql } = buildTable({ tags: { maxArrayLength: 20 } });

      expect(checkSql('demo_tags_length_check')).toBe(
        '"demo"."tags" IS NULL OR array_length("demo"."tags", 1) <= 20',
      );
    });

    it('should accept zero as the cap', () => {
      const { checkSql } = buildTable({ tags: { maxArrayLength: 0 } });

      expect(checkSql('demo_tags_length_check')).toContain('<= 0');
    });

    it('should emit nothing when maxArrayLength is present but undefined', () => {
      const { constraints } = buildTable({ tags: { maxArrayLength: undefined } });

      expect(constraints).toEqual([]);
    });
  });

  describe('json constraints', () => {
    it('should require an object when enforceObject is true', () => {
      const { checkSql } = buildTable({ meta: { enforceObject: true } });

      expect(checkSql('demo_meta_check')).toBe(
        `"demo"."meta" IS NULL OR jsonb_typeof("demo"."meta") = 'object'`,
      );
    });

    it('should not require an object when enforceObject is false', () => {
      const { constraints } = buildTable({ meta: { enforceObject: false } });

      expect(constraints).toEqual([]);
    });

    it('should cap the serialised json size', () => {
      const { checkSql } = buildTable({ meta: { maxJsonSize: 4096 } });

      expect(checkSql('demo_meta_size_check')).toBe(
        '"demo"."meta" IS NULL OR length("demo"."meta"::text) <= 4096',
      );
    });

    it('should emit both json checks, object shape first', () => {
      const { checkNames } = buildTable({
        meta: { enforceObject: true, maxJsonSize: 100 },
      });

      expect(checkNames).toEqual(['demo_meta_check', 'demo_meta_size_check']);
    });

    it('should emit nothing when both json keys are undefined', () => {
      const { constraints } = buildTable({
        meta: { enforceObject: undefined, maxJsonSize: undefined },
      });

      expect(constraints).toEqual([]);
    });
  });

  describe('number constraints', () => {
    it('should emit a range check when both bounds are set', () => {
      const { checkSql } = buildTable({ age: { min: 0, max: 130 } });

      expect(checkSql('demo_age_range_check')).toBe(
        '"demo"."age" IS NULL OR ("demo"."age" >= 0 AND "demo"."age" <= 130)',
      );
    });

    it('should emit a min check when only min is set', () => {
      const { checkSql } = buildTable({ age: { min: 18 } });

      expect(checkSql('demo_age_min_check')).toBe(
        '"demo"."age" IS NULL OR "demo"."age" >= 18',
      );
    });

    it('should emit a max check when only max is set', () => {
      const { checkSql } = buildTable({ age: { max: 99 } });

      expect(checkSql('demo_age_max_check')).toBe(
        '"demo"."age" IS NULL OR "demo"."age" <= 99',
      );
    });

    it('should treat a zero bound as present', () => {
      const { checkNames } = buildTable({ age: { max: 0 } });

      expect(checkNames).toEqual(['demo_age_max_check']);
    });

    it('should render negative and fractional bounds verbatim', () => {
      const { checkSql } = buildTable({ price: { min: -1.5, max: 2.25 } });

      expect(checkSql('demo_price_range_check')).toBe(
        '"demo"."price" IS NULL OR ("demo"."price" >= -1.5 AND "demo"."price" <= 2.25)',
      );
    });

    it('should emit nothing when both number keys are undefined', () => {
      const { constraints } = buildTable({ age: { min: undefined, max: undefined } });

      expect(constraints).toEqual([]);
    });
  });

  describe('date constraints', () => {
    it('should emit a range check when both bounds are set', () => {
      const { checkSql } = buildTable({
        bornOn: { minDate: '1900-01-01', maxDate: '2100-12-31' },
      });

      expect(checkSql('demo_born_on_date_range_check')).toBe(
        `"demo"."born_on" IS NULL OR ("demo"."born_on" >= '1900-01-01'::date AND "demo"."born_on" <= '2100-12-31'::date)`,
      );
    });

    it('should emit a min check when only minDate is set', () => {
      const { checkSql } = buildTable({ bornOn: { minDate: '1900-01-01' } });

      expect(checkSql('demo_born_on_min_date_check')).toBe(
        `"demo"."born_on" IS NULL OR "demo"."born_on" >= '1900-01-01'::date`,
      );
    });

    it('should emit a max check when only maxDate is set', () => {
      const { checkSql } = buildTable({ bornOn: { maxDate: '2100-12-31' } });

      expect(checkSql('demo_born_on_max_date_check')).toBe(
        `"demo"."born_on" IS NULL OR "demo"."born_on" <= '2100-12-31'::date`,
      );
    });

    it('should emit nothing when both date keys are undefined', () => {
      const { constraints } = buildTable({
        bornOn: { minDate: undefined, maxDate: undefined },
      });

      expect(constraints).toEqual([]);
    });
  });

  describe('email constraints', () => {
    it('should use the permissive pattern by default', () => {
      const { checkSql } = buildTable({ email: { strictValidation: false } });

      expect(checkSql('demo_email_email_check')).toBe(
        `"demo"."email" IS NULL OR "demo"."email" ~* ${LOOSE_EMAIL_REGEX}`,
      );
    });

    it('should use the permissive pattern when strictValidation is undefined', () => {
      const { checkSql } = buildTable({ email: { strictValidation: undefined } });

      expect(checkSql('demo_email_email_check')).toContain(LOOSE_EMAIL_REGEX);
    });

    it('should use the strict pattern when asked', () => {
      const { checkSql } = buildTable({ email: { strictValidation: true } });

      expect(checkSql('demo_email_email_check')).toBe(
        `"demo"."email" IS NULL OR "demo"."email" ~* ${STRICT_EMAIL_REGEX}`,
      );
    });

    it('should escape the apostrophe the strict pattern contains', () => {
      const { checkSql } = buildTable({ email: { strictValidation: true } });
      const literal = checkSql('demo_email_email_check').slice(
        checkSql('demo_email_email_check').indexOf("'"),
      );

      // A lone apostrophe would close the literal early and break the DDL.
      expect(literal.match(/'/gu)).toHaveLength(4);
      expect(literal).toContain("&''*");
    });
  });

  describe('enum constraints', () => {
    it('should restrict the column to the allowed values', () => {
      const { checkSql } = buildTable({
        status: { allowedValues: ['draft', 'published'] },
      });

      expect(checkSql('demo_status_enum_check')).toBe(
        `"demo"."status" IS NULL OR "demo"."status" IN ('draft', 'published')`,
      );
    });

    it('should escape apostrophes inside allowed values', () => {
      const { checkSql } = buildTable({ status: { allowedValues: ["O'Brien"] } });

      expect(checkSql('demo_status_enum_check')).toBe(
        `"demo"."status" IS NULL OR "demo"."status" IN ('O''Brien')`,
      );
    });

    it('should neutralise a value that tries to escape the literal', () => {
      const { checkSql } = buildTable({
        status: { allowedValues: ["x') OR true --"] },
      });

      expect(checkSql('demo_status_enum_check')).toBe(
        `"demo"."status" IS NULL OR "demo"."status" IN ('x'') OR true --')`,
      );
    });

    it('should emit nothing for an empty allowed list', () => {
      const { constraints } = buildTable({ status: { allowedValues: [] } });

      expect(constraints).toEqual([]);
    });

    it('should emit nothing when allowedValues is present but undefined', () => {
      const { constraints } = buildTable({ status: { allowedValues: undefined } });

      expect(constraints).toEqual([]);
    });
  });

  describe('sql literal escaping', () => {
    it('should neutralise an apostrophe in a date bound', () => {
      const { checkSql } = buildTable({
        bornOn: { minDate: "2020-01-01'::date OR true --" },
      });

      expect(checkSql('demo_born_on_min_date_check')).toBe(
        `"demo"."born_on" IS NULL OR "demo"."born_on" >= '2020-01-01''::date OR true --'::date`,
      );
    });

    it('should neutralise an apostrophe in both date bounds', () => {
      const { checkSql } = buildTable({
        bornOn: { minDate: "a'b", maxDate: "c'd" },
      });

      expect(checkSql('demo_born_on_date_range_check')).toBe(
        `"demo"."born_on" IS NULL OR ("demo"."born_on" >= 'a''b'::date AND "demo"."born_on" <= 'c''d'::date)`,
      );
    });

    it('should neutralise an apostrophe in a maxDate-only bound', () => {
      const { checkSql } = buildTable({ bornOn: { maxDate: "c'd" } });

      expect(checkSql('demo_born_on_max_date_check')).toContain(`'c''d'::date`);
    });
  });

  describe('combined configuration', () => {
    it('should emit the index before the checks for a single field', () => {
      const { indexNames, checkNames } = buildTable({
        bio: { index: true, minLength: 1, maxLength: 5 },
      });

      expect(indexNames).toEqual(['demo_bio_idx']);
      expect(checkNames).toEqual(['demo_bio_length_check']);
    });

    it('should emit constraints in config key order across fields', () => {
      const { constraints } = buildTable({
        email: { index: 'unique', strictValidation: false },
        age: { min: 0 },
        status: { allowedValues: ['a'] },
      });

      expect(constraints).toHaveLength(4);
    });

    it('should combine unrelated constraint families on one column', () => {
      const { checkNames } = buildTable({
        age: { min: 1, max: 2, minDate: '2020-01-01' },
      });

      expect(checkNames).toEqual(['demo_age_range_check', 'demo_age_min_date_check']);
    });

    it('should apply every family across a realistic table', () => {
      const { indexNames, checkNames } = buildTable({
        id: { index: 'unique' },
        name: { index: true, minLength: 1, maxLength: 120 },
        website: { urlLength: true },
        tags: { maxArrayLength: 10 },
        meta: { enforceObject: true, maxJsonSize: 8192 },
        age: { min: 0, max: 130 },
        bornOn: { minDate: '1900-01-01', maxDate: '2100-12-31' },
        email: { index: 'unique', strictValidation: true },
        status: { allowedValues: ['draft', 'published'] },
        createdAt: { index: true },
      });

      expect(indexNames).toEqual([
        'demo_id_unique',
        'demo_display_name_idx',
        'demo_email_unique',
        'demo_created_at_idx',
      ]);
      expect(checkNames).toEqual([
        'demo_display_name_length_check',
        'demo_website_length_check',
        'demo_tags_length_check',
        'demo_meta_check',
        'demo_meta_size_check',
        'demo_age_range_check',
        'demo_born_on_date_range_check',
        'demo_email_email_check',
        'demo_status_enum_check',
      ]);
    });
  });

  describe('known limitations', () => {
    it('should reuse the same check name for string and array length caps', () => {
      // Both families name their check `<table>_<column>_length_check`, so
      // configuring them together yields a duplicate Postgres rejects at DDL
      // time. The combination is nonsensical anyway — `length()` does not
      // apply to arrays — but the collision is not guarded against.
      const { checkNames } = buildTable({ tags: { maxLength: 5, maxArrayLength: 5 } });

      expect(checkNames).toEqual(['demo_tags_length_check', 'demo_tags_length_check']);
    });

    it('should not validate that a config family suits the column type', () => {
      const { checkSql } = buildTable({ age: { maxLength: 5 } });

      expect(checkSql('demo_age_length_check')).toContain('length("demo"."age")');
    });
  });

  describe('input handling', () => {
    it('should not mutate the config it is given', () => {
      const config = { bio: { index: 'unique' as const, minLength: 1, maxLength: 2 } };
      const snapshot = structuredClone(config);

      buildTable(config);

      expect(config).toEqual(snapshot);
    });

    it('should produce identical output for identical input', () => {
      const config = { email: { index: true, strictValidation: true } };

      expect(buildTable(config).checks).toEqual(buildTable(config).checks);
    });

    it('should accept a bare column map outside of a pgTable callback', () => {
      const table = pgTable('bare', demoColumns());
      const constraints = generateTableConstraints(
        { bio: table.bio },
        { bio: { maxLength: 3 } },
      );

      expect(constraints).toHaveLength(1);
    });
  });
});
