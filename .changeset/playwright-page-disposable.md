---
'@xstate/test': patch
---

`createPlaywrightSut(page)` accepts a `Page` from `@playwright/test` 1.64 and later. `PlaywrightPage` methods that return promises now return `Promise<unknown>`, so a `Page` whose `context().tracing.start()` returns `Promise<Disposable>` type-checks.
