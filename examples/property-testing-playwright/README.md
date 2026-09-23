# Property testing a multi-step form with Playwright

A three-step form (name, email, review) served as static HTML, checked against
an XState model with `propertyTest()` and `@xstate/test/playwright`.

## Files

| File | Contents |
| --- | --- |
| `public/index.html` | The app, plain HTML and JavaScript. Loading it with `?bug` makes the email step accept any non-empty value. |
| `machine.ts` | The model: steps, back navigation, validation errors. |
| `form.spec.ts` | Two Playwright tests. Generated `FILL`/`NEXT`/`BACK` sequences run against the page, and the step label and the error message are compared after every event. The same `sut` carries a per-state assertion in `states`. |
| `server.mjs` | A static file server, started by `playwright.config.ts`. |
| `.gitignore` | Ignores `.xstate-test/` and Playwright's `test-results/`. |

## Running

Install dependencies and the Chromium build Playwright uses:

```bash
pnpm install
pnpm exec playwright install chromium
```

In this repository, build the workspace packages once from the repository root
with `pnpm build`. After `pnpm install`, the packages' `dist` files point at
their TypeScript sources, which Playwright cannot import.

Then run the tests from this directory:

```bash
pnpm test
```

This example is not run in CI, because it needs a browser download.

## The model

The model mirrors what the page can observe. Two details follow from that:

- `FILL` clears the error only when the value changes. The page clears the
  error in its `input` listener, and `page.fill()` with the field's current
  value does not fire `input`. Without this, `NEXT` on an empty name followed
  by `FILL` with `''` shows the error on the page but not in the model.
- The field is disabled on the review and done steps, so `FILL` has a `when`
  that offers it only on the name and email steps. `page.fill()` on a disabled
  field waits until the test times out.

`BACK` on the name step and `NEXT` on the done step are still sent. The model
has no transition for them, so each step checks that the page does not move
either.

`FILL` has a second event case, `valid`, whose `resolve` picks a value the
current step accepts. Random values rarely pass both validation steps, and
`reachable: ['#form.done']` fails the campaign if no run submits the form.

## 1. `the form matches its model`

The test passes and prints the coverage report:

```
Test coverage

states: 4/4 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
stateNodes: 5/5 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
configurations: 4/4 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
statuses: 1/1 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
eventTypes: 4/4 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
transitions: 7/7 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
guards: 0/0 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
transitionPairs: 16/16 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
requirements: 0/0 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown
frontiers: 0/0 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown

event cases:
  - BACK / default: 117 generated, 117 applicable, 117 executed, 0 ignored
  - FILL / default: 117 generated, 114 applicable, 114 executed, 3 ignored
  - FILL / valid: 107 generated, 103 applicable, 103 executed, 4 ignored
  - NEXT / default: 130 generated, 130 applicable, 130 executed, 0 ignored
temporal: 1 satisfied, 0 failed, 0 inconclusive
  - reachable:#form.done: 1 satisfied, 0 failed, 99 inconclusive

exploration:
  runs: configured 100, completed 100, attempted 100
  sequence length: max 10, max observed 10
  stopped because: budget
  truncated: true (maximum sequence length reached)
  frontier ["frontier","initial"]: prefix 0, budget n/a, configured 100, completed 100, attempted 100
  seed ["frontier","initial"]: engine fast-check, seed 1, path n/a
```

Every transition is taken. `FILL` cases are `ignored` on the review and done
steps, where `when` returns `false`.

## 2. `reports a counterexample when the form is buggy`

The same campaign against `/?bug` must reject with a divergence. fast-check
shrinks the failing run to four events:

```
Property observation diverged
Reproduce: seed 1, path "95:3:4", replayPath "GCJ:F"
Fixture: failure.fixture (replayTest)
Shrunk 2 time(s)

start {"value":"name","context":{"name":"","email":"","error":""}}
1. generator FILL {"value":"Ada"} -> {"value":"name","context":{"name":"Ada","email":"","error":""}}
2. generator NEXT -> {"value":"email","context":{"name":"Ada","email":"","error":""}}
3. generator FILL {"value":"Ada"} -> {"value":"email","context":{"name":"Ada","email":"Ada","error":""}}
4. generator NEXT -> {"value":"email","context":{"name":"Ada","email":"Ada","error":"email is invalid"}}
   sut diverged
     model:    {"step":"email","error":"email is invalid"}
     observed: {"step":"review","error":""}
```

The model rejects `Ada` as an email. The buggy page accepts it and moves to
the review step.

## See also

`createPlaywrightSut()` returns the `sut` shape that both `propertyTest()` and
`testPaths()` take, so the same configuration runs under `testPaths()`.

The [`@xstate/test` README](../../packages/xstate-test#test-a-web-page-with-playwright)
documents every `createPlaywrightSut()` option.
