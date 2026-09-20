import type { AnyPgColumn, CheckBuilder, IndexBuilder } from 'drizzle-orm/pg-core';
import { getTableName, sql } from 'drizzle-orm';
import { check, index, uniqueIndex } from 'drizzle-orm/pg-core';

// --------------------
// Config Types
// --------------------
interface BaseFieldConfig {
  index?: boolean | 'unique';
}

export interface StringFieldConfig extends BaseFieldConfig {
  minLength?: number;
  maxLength?: number;
  urlLength?: boolean;
}

export interface ArrayFieldConfig extends BaseFieldConfig {
  maxArrayLength?: number;
}

export interface JsonFieldConfig extends BaseFieldConfig {
  maxJsonSize?: number;
  enforceObject?: boolean;
}

export interface NumberFieldConfig extends BaseFieldConfig {
  min?: number;
  max?: number;
}

export interface BooleanFieldConfig extends BaseFieldConfig {}

export interface TimestampFieldConfig extends BaseFieldConfig {}

export interface UuidFieldConfig extends BaseFieldConfig {}

// Missing field types added below:

export interface DateFieldConfig extends BaseFieldConfig {
  minDate?: string; // ISO date string format
  maxDate?: string; // ISO date string format
}

export interface EmailFieldConfig extends BaseFieldConfig {
  strictValidation?: boolean; // For more strict email regex
}

export interface EnumFieldConfig extends BaseFieldConfig {
  allowedValues?: string[];
}

export interface DecimalFieldConfig extends BaseFieldConfig {
  precision?: number;
  scale?: number;
  min?: number;
  max?: number;
}

export type GeneratedConstraints = (IndexBuilder | CheckBuilder)[];

// For the main function, accept any config type but validate at runtime
type AnyFieldConfig =
  | StringFieldConfig
  | ArrayFieldConfig
  | JsonFieldConfig
  | NumberFieldConfig
  | BooleanFieldConfig
  | TimestampFieldConfig
  | UuidFieldConfig
  | DateFieldConfig
  | EmailFieldConfig
  | EnumFieldConfig
  | DecimalFieldConfig;

type ConfigForColumn<_T extends AnyPgColumn> = AnyFieldConfig;

// --------------------
// Constraint Generator
// --------------------
export function generateTableConstraints<TTable extends Record<string, AnyPgColumn>>(
  table: TTable,
  fieldsConfig: {
    [K in keyof TTable]?: ConfigForColumn<TTable[K]>;
  },
): GeneratedConstraints {
  const constraints: GeneratedConstraints = [];

  // Get table name from the first column's table reference
  const firstColumn = Object.values(table)[0];
  const tableName = firstColumn ? getTableName(firstColumn.table) : null;

  if (tableName == null) {
    throw new Error('Unable to determine table name for constraint generation.');
  }

  for (const [fieldName, config] of Object.entries(fieldsConfig)) {
    if (!config) {
      continue;
    }

    const column = table[fieldName as keyof TTable];

    if (!column) {
      continue;
    }
    const columnName = column.name; // Use actual database column name, not JS field name

    // Determine column type from config instead of SQL type
    const isStringConfig =
      'minLength' in config || 'maxLength' in config || 'urlLength' in config;
    const isArrayConfig = 'maxArrayLength' in config;
    const isJsonConfig = 'maxJsonSize' in config || 'enforceObject' in config;
    const isNumberConfig = 'min' in config || 'max' in config;
    const isDateConfig = 'minDate' in config || 'maxDate' in config;
    const isEmailConfig = 'strictValidation' in config;
    const isEnumConfig = 'allowedValues' in config;

    // Indexes
    if (config.index === true) {
      constraints.push(index(`${tableName}_${columnName}_idx`).on(column));
    } else if (config.index === 'unique') {
      constraints.push(uniqueIndex(`${tableName}_${columnName}_unique`).on(column));
    }

    // String constraints - apply to string config
    if (isStringConfig) {
      if (config.urlLength) {
        constraints.push(
          check(
            `${tableName}_${columnName}_length_check`,
            sql`${column} IS NULL OR length(${column}) <= 2048`,
          ),
        );
      } else if (config.minLength !== undefined && config.maxLength !== undefined) {
        constraints.push(
          check(
            `${tableName}_${columnName}_length_check`,
            sql`${column} IS NULL OR (length(${column}) >= ${sql.raw(String(config.minLength))} AND length(${column}) <= ${sql.raw(String(config.maxLength))})`,
          ),
        );
      } else if (config.minLength !== undefined) {
        constraints.push(
          check(
            `${tableName}_${columnName}_length_check`,
            sql`${column} IS NULL OR length(${column}) >= ${sql.raw(String(config.minLength))}`,
          ),
        );
      } else if (config.maxLength !== undefined) {
        constraints.push(
          check(
            `${tableName}_${columnName}_length_check`,
            sql`${column} IS NULL OR length(${column}) <= ${sql.raw(String(config.maxLength))}`,
          ),
        );
      }
    }

    // Array constraints - apply to array config
    if (isArrayConfig && config.maxArrayLength !== undefined) {
      constraints.push(
        check(
          `${tableName}_${columnName}_length_check`,
          sql`${column} IS NULL OR array_length(${column}, 1) <= ${sql.raw(String(config.maxArrayLength))}`,
        ),
      );
    }

    // JSON constraints - apply to JSON config
    if (isJsonConfig) {
      if (config.enforceObject) {
        constraints.push(
          check(
            `${tableName}_${columnName}_check`,
            sql`${column} IS NULL OR jsonb_typeof(${column}) = 'object'`,
          ),
        );
      }
      if (config.maxJsonSize !== undefined) {
        constraints.push(
          check(
            `${tableName}_${columnName}_size_check`,
            sql`${column} IS NULL OR length(${column}::text) <= ${sql.raw(String(config.maxJsonSize))}`,
          ),
        );
      }
    }

    // Number constraints - apply to number config
    if (isNumberConfig) {
      if (config.min !== undefined && config.max !== undefined) {
        constraints.push(
          check(
            `${tableName}_${columnName}_range_check`,
            sql`${column} IS NULL OR (${column} >= ${sql.raw(String(config.min))} AND ${column} <= ${sql.raw(String(config.max))})`,
          ),
        );
      } else if (config.min !== undefined) {
        constraints.push(
          check(
            `${tableName}_${columnName}_min_check`,
            sql`${column} IS NULL OR ${column} >= ${sql.raw(String(config.min))}`,
          ),
        );
      } else if (config.max !== undefined) {
        constraints.push(
          check(
            `${tableName}_${columnName}_max_check`,
            sql`${column} IS NULL OR ${column} <= ${sql.raw(String(config.max))}`,
          ),
        );
      }
    }

    // Date constraints - apply to date config
    if (isDateConfig) {
      if (config.minDate !== undefined && config.maxDate !== undefined) {
        constraints.push(
          check(
            `${tableName}_${columnName}_date_range_check`,
            sql`${column} IS NULL OR (${column} >= ${sql.raw(`'${config.minDate}'`)}::date AND ${column} <= ${sql.raw(`'${config.maxDate}'`)}::date)`,
          ),
        );
      } else if (config.minDate !== undefined) {
        constraints.push(
          check(
            `${tableName}_${columnName}_min_date_check`,
            sql`${column} IS NULL OR ${column} >= ${sql.raw(`'${config.minDate}'`)}::date`,
          ),
        );
      } else if (config.maxDate !== undefined) {
        constraints.push(
          check(
            `${tableName}_${columnName}_max_date_check`,
            sql`${column} IS NULL OR ${column} <= ${sql.raw(`'${config.maxDate}'`)}::date`,
          ),
        );
      }
    }

    // Email constraints - apply to email config
    if (isEmailConfig) {
      const emailRegex = config.strictValidation
        ? "^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$"
        : '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$';

      constraints.push(
        check(
          `${tableName}_${columnName}_email_check`,
          sql`${column} IS NULL OR ${column} ~* ${sql.raw(`'${emailRegex}'`)}`,
        ),
      );
    }

    // Enum constraints - apply to enum config
    if (isEnumConfig && config.allowedValues && config.allowedValues.length > 0) {
      const valuesList = config.allowedValues.map((val) => `'${val}'`).join(', ');
      constraints.push(
        check(
          `${tableName}_${columnName}_enum_check`,
          sql`${column} IS NULL OR ${column} IN (${sql.raw(valuesList)})`,
        ),
      );
    }
  }

  return constraints;
}
