---
'@xstate/test': minor
---

Added `@xstate/test/playwright`, a Playwright integration for `propertyTest()`
and `testPaths()`.

`createPlaywrightSut(page, config)` drives a page as the system under test. It
compares a DOM projection with the model after every step, runs per-state page
assertions from `states`, or both:

```ts
await propertyTest(formMachine, {
  numRuns: 25,
  events: { NEXT: fc.constant({}) },
  sut: createPlaywrightSut(page, {
    reset: async (page) => {
      await page.goto('/form.html');
    },
    events: { NEXT: (page) => page.click('#next') },
    read: (page) => page.locator('#step').textContent(),
    projectModel: (snapshot) => snapshot.value
  })
});
```

Settling, clock advancement (`page.clock.runFor()`), checkpoint screenshots,
and per-case `page.route()` mocks have defaults, and each can be overridden.
Routes a mock installs are removed when the run ends, including on Playwright
versions whose `route()` returns a disposable registration. Playwright is an
optional peer dependency; any object with the parts of `Page` the
configuration uses is accepted.
