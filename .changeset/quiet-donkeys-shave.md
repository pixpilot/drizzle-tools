---
'@pixpilot/drizzle-pg': patch
---

Escape single quotes in the SQL literals `generateTableConstraints` emits.

Date bounds, enum values and the email regex were interpolated into `sql.raw`
unquoted, so an apostrophe closed the literal early. `strictValidation: true`
produced DDL Postgres rejected outright — its regex contains a literal `'` —
and any `allowedValues` or `minDate`/`maxDate` containing an apostrophe either
broke the statement or changed the meaning of the constraint.

Also widened the `fieldsConfig` parameter to accept an explicit `undefined` per
field, matching the guard the function already had.
