import type { PgTable } from 'drizzle-orm/pg-core';

import type { GeneratedConstraints } from '../src';

import { is } from 'drizzle-orm';
import {
  boolean,
  date,
  getTableConfig,
  IndexedColumn,
  integer,
  jsonb,
  numeric,
  PgDialect,
  pgTable,
  text,
  uuid,
} from 'drizzle-orm/pg-core';
import { generateTableConstraints, timestamptz } from '../src';

const dialect = new PgDialect();

export interface RenderedIndex {
  name: string | undefined;
  unique: boolean;
  columns: string[];
}

export interface RenderedCheck {
  name: string;
  sql: string;
}

/**
 * Every config interface the generator accepts. The source keeps this union
 * private, so the tests re-declare it to drive table-wide config maps.
 */
export interface FieldConfig {
  index?: boolean | 'unique' | undefined;
  minLength?: number | undefined;
  maxLength?: number | undefined;
  urlLength?: boolean | undefined;
  maxArrayLength?: number | undefined;
  maxJsonSize?: number | undefined;
  enforceObject?: boolean | undefined;
  min?: number | undefined;
  max?: number | undefined;
  minDate?: string | undefined;
  maxDate?: string | undefined;
  strictValidation?: boolean | undefined;
  allowedValues?: string[] | undefined;
  precision?: number | undefined;
  scale?: number | undefined;
}

export interface BuiltTable {
  table: PgTable;
  constraints: GeneratedConstraints;
  indexes: RenderedIndex[];
  checks: RenderedCheck[];
  indexNames: string[];
  checkNames: string[];
  /** SQL of the single check with this name; throws when it is absent. */
  checkSql: (name: string) => string;
}

/**
 * Column builders are stateful once bound to a table, so each build gets a
 * fresh set rather than sharing one module-level object between tests.
 */
export function demoColumns() {
  return {
    id: uuid('id'),
    name: text('display_name'),
    bio: text('bio'),
    website: text('website'),
    tags: text('tags').array(),
    meta: jsonb('meta'),
    age: integer('age'),
    price: numeric('price'),
    active: boolean('active'),
    bornOn: date('born_on'),
    email: text('email'),
    status: text('status'),
    createdAt: timestamptz('created_at'),
  };
}

/**
 * The generated builders are opaque until a table binds them, and index
 * builders only accept the extra-config columns drizzle passes to the third
 * `pgTable` argument. Running every case through a real table therefore both
 * exercises the supported call site and lets the assertions read back the SQL
 * Postgres would actually receive.
 */
export function buildTable(
  fieldsConfig: Record<string, FieldConfig | undefined>,
  tableName = 'demo',
): BuiltTable {
  let constraints: GeneratedConstraints = [];

  const table = pgTable(tableName, demoColumns(), (columns) => {
    constraints = generateTableConstraints(columns, fieldsConfig);
    return constraints;
  });

  const config = getTableConfig(table);

  const indexes: RenderedIndex[] = config.indexes.map((index) => ({
    name: index.config.name,
    unique: index.config.unique,
    columns: index.config.columns.map((column) =>
      is(column, IndexedColumn) ? (column.name ?? '<unnamed>') : '<sql>',
    ),
  }));

  const checks: RenderedCheck[] = config.checks.map((check) => ({
    name: check.name,
    sql: dialect.sqlToQuery(check.value).sql,
  }));

  return {
    table,
    constraints,
    indexes,
    checks,
    indexNames: indexes.map((index) => index.name ?? '<unnamed>'),
    checkNames: checks.map((check) => check.name),
    checkSql: (name) => {
      const matches = checks.filter((check) => check.name === name);

      if (matches.length !== 1) {
        throw new Error(
          `Expected exactly one check named "${name}", found ${matches.length}. All: ${checks
            .map((check) => check.name)
            .join(', ')}`,
        );
      }

      return matches[0]!.sql;
    },
  };
}
