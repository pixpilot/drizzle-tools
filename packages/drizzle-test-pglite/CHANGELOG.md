# @pixpilot/drizzle-test-pglite

## 0.2.0

### Minor Changes

- add support for PGlite options and migrations
- f77097f: Add `pgliteOptions`, passed to every PGlite instance (template and worker), so extensions such as pgvector load: `pgliteOptions: { extensions: { vector } }`. Add `migrationsFolder` to build the template from Drizzle migrations instead of a schema push.

## 0.1.1

### Patch Changes

- 3dc388b: fix release

## 0.1.0

### Minor Changes

- add initial test setup and configuration
