# `@xstate/test-playwright`

Drive a Playwright page as the system under test for XState property testing.

`propertyTest()` generates event sequences from a machine, runs them against the
model and against your app, and compares the two after every step. This package
supplies the Playwright half: it turns a `Page` and a small configuration into
the `sut` or `test` option that `propertyTest()` expects.

## Installation

```bash
pnpm add -D @xstate/test-playwright xstate @playwright/test
```

Playwright is an optional peer dependency (`@playwright/test` or `playwright`,
version 1.40 or later). The package has no runtime dependencies: it never
imports Playwright, it only accepts any object that structurally matches the
parts of `Page` it uses, so a real `Page` is assignable without extra typing.

A generator adapter such as [`@xstate/fast-check`](../xstate-fast-check) is also
required to produce event sequences.

## Style 1: `createPlaywrightSut`

`createPlaywrightSut(page, config)` returns a `PropertySut`. The runner projects
both the model snapshot and the DOM to comparable values and fails the run when
they diverge.

```ts
import { test } from '@playwright/test';
import * as fc from 'fast-check';
import { propertyTest, formatPropertyCoverage } from 'xstate/graph';
import { fastCheckAdapter } from '@xstate/fast-check';
import { createPlaywrightSut } from '@xstate/test-playwright';
import { formMachine } from './machine';

test('the form matches the model', async ({ page }) => {
  const { coverage } = await propertyTest(formMachine, {
    adapter: fastCheckAdapter({ numRuns: 25, maxCommands: 8 }),
    events: {
      NEXT: fc.constant({}),
      BACK: fc.constant({}),
      EDIT: fc.record({ value: fc.string() })
    },
    sut: createPlaywrightSut(page, {
      reset: async (page) => {
        await page.goto('/form.html');
      },
      events: {
        NEXT: (page) => page.click('#next'),
        BACK: (page) => page.click('#back'),
        EDIT: (page, event) => page.fill('#field', event.value)
      },
      read: async (page) => ({
        step: await page.locator('#step').textContent(),
        error: await page.locator('#error').textContent()
      }),
      projectModel: (snapshot) => ({
        step: snapshot.value,
        error: snapshot.context.error
      })
    }),
    invariant: () => {}
  });

  console.log(formatPropertyCoverage(coverage));
});
```

### Configuration

| Option          | Default                                       | Purpose                                              |
| --------------- | --------------------------------------------- | ---------------------------------------------------- |
| `events`        | required                                      | Performs each generated event against the page.      |
| `read`          | required                                      | Projects the DOM to a model-comparable value.        |
| `projectModel`  | required                                      | Projects the model snapshot to the same shape.       |
| `projectSut`    | identity                                      | Normalizes the value from `read` before comparison.  |
| `equivalent`    | deep equality                                 | Compares the two projections.                        |
| `settle`        | `page.waitForLoadState('networkidle')`        | Waits for quiescence before every comparison.        |
| `advance`       | `page.clock.runFor(ms)`                       | Advances page time for `advance` commands.           |
| `checkpoint`    | screenshot into `screenshotDir`               | Records a checkpoint.                                |
| `screenshotDir` | `property-screenshots`                        | Directory for default checkpoint screenshots.        |
| `reset`         | none                                          | Runs once when a scenario session is created.        |
| `stop`          | none                                          | Runs when a scenario stops.                          |
| `dispose`       | none                                          | Runs when a scenario session is disposed.            |
| `mocks`         | none                                          | Per-case `page.route()` setup, applied before events. |
| `caseOf`        | `event.case ?? event.type`                    | Resolves the mock case for an event.                 |

Every scenario run creates a new session, so put navigation or app state reset
in `reset`. Without it, state left over from the previous run diverges from the
freshly started model.

## Style 2: `createPlaywrightTestModelSession`

If you prefer assertions over projections, `createPlaywrightTestModelSession`
adapts the `TestParam` style (`events` executors and `states` assertions) to the
`test` option:

```ts
await propertyTest(formMachine, {
  adapter: fastCheckAdapter({ numRuns: 25 }),
  events: { NEXT: fc.constant({}), BACK: fc.constant({}) },
  test: createPlaywrightTestModelSession(page, {
    reset: (page) => page.goto('/form.html'),
    events: {
      NEXT: (page, step) => page.click('#next'),
      BACK: (page) => page.click('#back')
    },
    states: {
      review: async (page, snapshot) => {
        await expect(page.locator('#summary')).toHaveText(
          snapshot.context.name
        );
      },
      '*': async (page, snapshot) => {
        await expect(page.locator('#step')).toHaveText(String(snapshot.value));
      }
    }
  }),
  invariant: () => {}
});
```

`states` keys are matched against the model state; `'*'` runs for every state
that no other key matched. The `events` executors receive the `Step`, so
`step.event` carries the generated payload.

Both styles can be combined with `sut` and `test` in the same `propertyTest()`
call when you want projection-based comparison and page assertions together.

## Mocks per case

`mocks` keys are event cases, not just event types, so the same event can be
steered down a success path or a failure path depending on which case the
generator picked:

```ts
createPlaywrightSut(page, {
  events: {
    SUBMIT: (page) => page.click('#submit')
  },
  mocks: {
    'SUBMIT.ok': (page) =>
      page.route('**/api/submit', (route) =>
        route.fulfill({ status: 200, body: '{"ok":true}' })
      ),
    'SUBMIT.error': (page) =>
      page.route('**/api/submit', (route) => route.fulfill({ status: 500 }))
  },
  caseOf: (event) => `${event.type}.${event.outcome}`,
  read,
  projectModel
});
```

The mock runs before the event action, and only when the resolved case differs
from the previously applied one, so repeated events do not stack routes. Since
`PropertySutSession.send` receives only the event, the case has to be derivable
from the event: put it in the payload (`{ type: 'SUBMIT', outcome: 'error' }`)
and map it with `caseOf`, which defaults to `event.case ?? event.type`.

## Clock

`advance` commands call `page.clock.runFor(milliseconds)` by default. Install
the clock before navigating for it to have any effect:

```ts
await page.clock.install();
await page.goto('/form.html');
```

Supply your own `advance` when the page needs more than a clock tick, for
example to also drain a queue and report the events that fired:

```ts
advance: async (page, ms) => {
  await page.clock.runFor(ms);
  return [{ type: 'TIMEOUT' }];
};
```

Returned events are fed back into the model, so return them only for timers that
the model also models.

## Screenshots

`checkpoint` commands write `‹screenshotDir›/‹label›.png`, with the label
sanitized for the filesystem and a `checkpoint-‹n›` fallback when the generator
did not supply one. Override `checkpoint` to trace something else, such as
appending the accessibility tree to a log.

## Failure output

A divergence throws a `PropertyTestFailure` from `xstate/graph` with the message
`Property observation diverged`. The error carries the shrunk trace:

- `failure.trace.steps` — every event, with its phase and payload; the last
  entry names the step that broke.
- `failure.trace.finalObservation.sut` — `{ model, observed }`, the two
  projections that failed to match.
- `failure.replay` and `failure.fixture` — replay the counterexample with
  `replayPropertyTest()`.
- `failure.coverage` — the coverage collected up to the failure, printable with
  `formatPropertyCoverage()`.
