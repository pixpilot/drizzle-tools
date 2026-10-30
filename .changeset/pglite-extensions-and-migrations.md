---
'@pixpilot/drizzle-test-pglite': minor
---

Add `pgliteOptions`, passed to every PGlite instance (template and worker), so extensions such as pgvector load: `pgliteOptions: { extensions: { vector } }`. Add `migrationsFolder` to build the template from Drizzle migrations instead of a schema push.
