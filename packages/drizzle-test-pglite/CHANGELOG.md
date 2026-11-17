# @pixpilot/drizzle-test-pglite

## 0.3.0

### Minor Changes

- add `warmTestDb` and `disposeTestDb` functions
- 5fc8de2: Add `warmTestDb()`, which builds the cached template snapshot without starting a database, so a Vitest global setup can build it once before workers start instead of each worker's first `beforeEach` outrunning the hook timeout on a cold cache. Add `disposeTestDb()`, which shuts down the worker's PGlite instance (`db.$client.close()` only releases the checkout).

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
