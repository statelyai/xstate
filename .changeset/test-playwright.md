---
'@xstate/test-playwright': minor
---

Added `@xstate/test-playwright`, a Playwright integration for `propertyTest()`.

`createPlaywrightSut(page, config)` drives a page as the system under test and compares a DOM projection against the model after every generated step:

```ts
await propertyTest(formMachine, {
  adapter: fastCheckAdapter({ numRuns: 25 }),
  events: { NEXT: fc.constant({}) },
  sut: createPlaywrightSut(page, {
    reset: (page) => page.goto('/form.html'),
    events: { NEXT: (page) => page.click('#next') },
    read: (page) => page.locator('#step').textContent(),
    projectModel: (snapshot) => snapshot.value
  }),
  invariant: () => {}
});
```

`createPlaywrightTestModelSession(page, params)` offers the same integration in the `events`/`states` assertion style, for the `test` option.

Settling, clock advancement (`page.clock.runFor()`), checkpoint screenshots and per-case `page.route()` mocks have sensible defaults and are individually overridable. Playwright is an optional peer dependency; the package has no runtime dependencies beyond `xstate`.
