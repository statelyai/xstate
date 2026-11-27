---
'@xstate/test': patch
---

`createPlaywrightSut(page)` accepts a `Page` from `@playwright/test` 1.64 and later, where `page.context().tracing.start()` returns `Promise<Disposable>`.
