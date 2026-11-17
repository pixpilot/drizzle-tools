---
'@pixpilot/drizzle-test-pglite': minor
---

Add `warmTestDb()`, which builds the cached template snapshot without starting a database, so a Vitest global setup can build it once before workers start instead of each worker's first `beforeEach` outrunning the hook timeout on a cold cache. Add `disposeTestDb()`, which shuts down the worker's PGlite instance (`db.$client.close()` only releases the checkout).
