import type { CheckBuilder, IndexBuilder } from 'drizzle-orm/pg-core';

import type {
  ArrayFieldConfig,
  BooleanFieldConfig,
  DateFieldConfig,
  DecimalFieldConfig,
  EmailFieldConfig,
  EnumFieldConfig,
  GeneratedConstraints,
  JsonFieldConfig,
  NumberFieldConfig,
  StringFieldConfig,
  TimestampFieldConfig,
  UuidFieldConfig,
} from '../src';

import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { describe, expectTypeOf, it } from 'vitest';

import { generateTableConstraints, timestamptz } from '../src';

const table = pgTable('demo', {
  id: uuid('id'),
  name: text('display_name'),
  age: integer('age'),
});

const columns = { id: table.id, name: table.name, age: table.age };

describe('GeneratedConstraints', () => {
  it('should be an array of drizzle index and check builders', () => {
    expectTypeOf<GeneratedConstraints>().toEqualTypeOf<(IndexBuilder | CheckBuilder)[]>();
  });

  it('should be what generateTableConstraints returns', () => {
    expectTypeOf(
      generateTableConstraints(columns, {}),
    ).toEqualTypeOf<GeneratedConstraints>();
  });

  it('should be accepted as the extra config of a pgTable', () => {
    expectTypeOf(
      pgTable('demo', { id: uuid('id') }, (t) =>
        generateTableConstraints(t, { id: { index: true } }),
      ),
    ).not.toBeNever();
  });
});

describe('generateTableConstraints config', () => {
  it('should accept a config keyed by the table columns', () => {
    expectTypeOf(
      generateTableConstraints(columns, {
        id: { index: 'unique' },
        name: { minLength: 1, maxLength: 2 },
        age: { min: 0, max: 1 },
      }),
    ).toEqualTypeOf<GeneratedConstraints>();
  });

  it('should allow every field to be omitted', () => {
    expectTypeOf(
      generateTableConstraints(columns, { name: undefined }),
    ).toEqualTypeOf<GeneratedConstraints>();
  });

  it('should reject a key that is not a column', () => {
    // @ts-expect-error - `missing` is not a column of the table
    generateTableConstraints(columns, { missing: { index: true } });
  });

  it('should reject an unknown config property', () => {
    // @ts-expect-error - `nope` is not part of any field config
    generateTableConstraints(columns, { name: { nope: true } });
  });

  it('should reject a non-boolean, non-"unique" index value', () => {
    // @ts-expect-error - only `true`, `false` and `'unique'` are allowed
    generateTableConstraints(columns, { name: { index: 'sorted' } });
  });

  it('should reject a non-numeric length bound', () => {
    // @ts-expect-error - `maxLength` is a number
    generateTableConstraints(columns, { name: { maxLength: '10' } });
  });

  it('should reject a non-string date bound', () => {
    // @ts-expect-error - dates are ISO strings, not Date objects
    generateTableConstraints(columns, { name: { minDate: new Date() } });
  });

  it('should reject a non-string-array allowed list', () => {
    // @ts-expect-error - `allowedValues` is a string array
    generateTableConstraints(columns, { name: { allowedValues: [1, 2] } });
  });

  it('should not tie a config family to a column type', () => {
    // Documented limitation: `ConfigForColumn` ignores the column, so a
    // string bound on an integer column is a type-level no-op.
    expectTypeOf(
      generateTableConstraints(columns, { age: { maxLength: 5 } }),
    ).toEqualTypeOf<GeneratedConstraints>();
  });

  it('should require the first argument to be a column map', () => {
    // @ts-expect-error - a plain object of strings is not a column map
    generateTableConstraints({ id: 'nope' }, {});
  });
});

describe('field config interfaces', () => {
  it('should give every config the shared index option', () => {
    expectTypeOf<StringFieldConfig['index']>().toEqualTypeOf<
      boolean | 'unique' | undefined
    >();
    expectTypeOf<ArrayFieldConfig['index']>().toEqualTypeOf<
      boolean | 'unique' | undefined
    >();
    expectTypeOf<JsonFieldConfig['index']>().toEqualTypeOf<
      boolean | 'unique' | undefined
    >();
    expectTypeOf<NumberFieldConfig['index']>().toEqualTypeOf<
      boolean | 'unique' | undefined
    >();
    expectTypeOf<BooleanFieldConfig['index']>().toEqualTypeOf<
      boolean | 'unique' | undefined
    >();
    expectTypeOf<TimestampFieldConfig['index']>().toEqualTypeOf<
      boolean | 'unique' | undefined
    >();
    expectTypeOf<UuidFieldConfig['index']>().toEqualTypeOf<
      boolean | 'unique' | undefined
    >();
    expectTypeOf<DateFieldConfig['index']>().toEqualTypeOf<
      boolean | 'unique' | undefined
    >();
    expectTypeOf<EmailFieldConfig['index']>().toEqualTypeOf<
      boolean | 'unique' | undefined
    >();
    expectTypeOf<EnumFieldConfig['index']>().toEqualTypeOf<
      boolean | 'unique' | undefined
    >();
    expectTypeOf<DecimalFieldConfig['index']>().toEqualTypeOf<
      boolean | 'unique' | undefined
    >();
  });

  it('should type the string config', () => {
    expectTypeOf<StringFieldConfig>().toEqualTypeOf<{
      index?: boolean | 'unique';
      minLength?: number;
      maxLength?: number;
      urlLength?: boolean;
    }>();
  });

  it('should type the array config', () => {
    expectTypeOf<ArrayFieldConfig>().toEqualTypeOf<{
      index?: boolean | 'unique';
      maxArrayLength?: number;
    }>();
  });

  it('should type the json config', () => {
    expectTypeOf<JsonFieldConfig>().toEqualTypeOf<{
      index?: boolean | 'unique';
      maxJsonSize?: number;
      enforceObject?: boolean;
    }>();
  });

  it('should type the number config', () => {
    expectTypeOf<NumberFieldConfig>().toEqualTypeOf<{
      index?: boolean | 'unique';
      min?: number;
      max?: number;
    }>();
  });

  it('should type the date config', () => {
    expectTypeOf<DateFieldConfig>().toEqualTypeOf<{
      index?: boolean | 'unique';
      minDate?: string;
      maxDate?: string;
    }>();
  });

  it('should type the email config', () => {
    expectTypeOf<EmailFieldConfig>().toEqualTypeOf<{
      index?: boolean | 'unique';
      strictValidation?: boolean;
    }>();
  });

  it('should type the enum config', () => {
    expectTypeOf<EnumFieldConfig>().toEqualTypeOf<{
      index?: boolean | 'unique';
      allowedValues?: string[];
    }>();
  });

  it('should type the decimal config', () => {
    expectTypeOf<DecimalFieldConfig>().toEqualTypeOf<{
      index?: boolean | 'unique';
      precision?: number;
      scale?: number;
      min?: number;
      max?: number;
    }>();
  });

  it('should leave the marker configs with only the index option', () => {
    expectTypeOf<BooleanFieldConfig>().toEqualTypeOf<{ index?: boolean | 'unique' }>();
    expectTypeOf<TimestampFieldConfig>().toEqualTypeOf<{ index?: boolean | 'unique' }>();
    expectTypeOf<UuidFieldConfig>().toEqualTypeOf<{ index?: boolean | 'unique' }>();
  });
});

describe('timestamptz', () => {
  it('should be interchangeable with the drizzle timestamp it wraps', () => {
    expectTypeOf(timestamptz).toEqualTypeOf<typeof timestamp>();
  });

  it('should return the same builder as timestamp for the named form', () => {
    expectTypeOf(timestamptz('at')).toEqualTypeOf(timestamp('at'));
  });

  it('should return the same builder as timestamp for the nameless form', () => {
    expectTypeOf(timestamptz()).toEqualTypeOf(timestamp());
  });

  it('should return the same builder as timestamp for the config-only form', () => {
    expectTypeOf(timestamptz({ mode: 'string' })).toEqualTypeOf(
      timestamp({ mode: 'string' }),
    );
  });

  it('should infer Date for the default mode', () => {
    const events = pgTable('events', { at: timestamptz('at').notNull() });

    expectTypeOf(events.$inferSelect).toEqualTypeOf<{ at: Date }>();
  });

  it('should infer string for mode: "string"', () => {
    const events = pgTable('events', {
      at: timestamptz('at', { mode: 'string' }).notNull(),
    });

    expectTypeOf(events.$inferSelect).toEqualTypeOf<{ at: string }>();
  });

  it('should infer a nullable column when notNull is not applied', () => {
    const events = pgTable('events', { at: timestamptz('at') });

    expectTypeOf(events.$inferSelect).toEqualTypeOf<{ at: Date | null }>();
  });

  it('should reject an unknown config option', () => {
    // @ts-expect-error - `zone` is not a timestamp option
    timestamptz('at', { zone: 'UTC' });
  });

  it('should reject an unknown mode', () => {
    // @ts-expect-error - only 'date' and 'string' are valid modes
    timestamptz('at', { mode: 'iso' });
  });
});
