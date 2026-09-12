# Property testing a multi-step form with Playwright

A three-step form (name, email, review) served as static HTML, checked against
an XState model with `propertyTest()` and `@xstate/test-playwright`.

- `public/index.html` — the app, plain HTML and JavaScript.
- `machine.ts` — the model: steps, back navigation, validation errors.
- `form.spec.ts` — the property test; generated `FILL`/`NEXT`/`BACK` sequences
  run against the page, and the step label plus the error message are compared
  after every event. Coverage is printed at the end.
- `server.mjs` — a static file server used by `playwright.config.ts`.

## Running

```bash
pnpm install
pnpm exec playwright install chromium
pnpm test
```

This example is not run in CI, because it needs a browser download.
