# @pixpilot/drizzle-pg

## 0.2.1

### Patch Changes

- escape single quotes in generated SQL literals
- 66db45d: Escape single quotes in the SQL literals `generateTableConstraints` emits.

  Date bounds, enum values and the email regex were interpolated into `sql.raw`
  unquoted, so an apostrophe closed the literal early. `strictValidation: true`
  produced DDL Postgres rejected outright — its regex contains a literal `'` —
  and any `allowedValues` or `minDate`/`maxDate` containing an apostrophe either
  broke the statement or changed the meaning of the constraint.

  Also widened the `fieldsConfig` parameter to accept an explicit `undefined` per
  field, matching the guard the function already had.

## 0.2.0

### Minor Changes

- add table constraint generation functionality

## 0.1.2

### Patch Changes

- 1f37956: fixed ci release

## 0.1.1

### Patch Changes

- 49f251e: ci release test

## 0.1.0

### Minor Changes

- initialize drizzle-pg package with essential files
