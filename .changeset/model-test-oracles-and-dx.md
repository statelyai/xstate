---
'xstate': minor
'@xstate/test': minor
---

Model tests gain a failure database, campaign-level oracles, page oracles and
failure artifacts for Playwright, Vitest integration, typed symbolic
references, and a statistics view.

- `failures` saves the fixture of a failing campaign and replays saved
  fixtures before the next campaign. A fixture that still fails fails the
  test at once; one that no longer fails is deleted. `propertyTest()` and
  `testPaths()` from `@xstate/test` write to `.xstate-test/`; the versions in
  `xstate/graph` accept any `TestFailureStore`.

  ```ts
  await propertyTest(cartMachine, {
    events,
    sut: cartSut,
    failures: { dir: '.xstate-test', replay: 'first', key: 'cart-store' }
  });
  // Saved: .xstate-test/cart-store/<hash>.json
  ```

- `temporal` accepts `sometimes`, which must hold on some step of some run,
  and `respond`, which requires every `trigger` step to be followed by a
  `response` step within `within` steps. `reachable` lists states that some
  run must enter. `sometimes` and `reachable` are checked when the campaign
  ends and throw a `TestCampaignError`.

  ```ts
  await propertyTest(cartMachine, {
    events,
    temporal: [
      {
        type: 'respond',
        id: 'payment-settles',
        within: 1,
        trigger: ({ snapshot }) => snapshot.matches('paying'),
        response: ({ snapshot }) => !snapshot.matches('paying')
      },
      {
        type: 'sometimes',
        id: 'declined',
        predicate: ({ snapshot }) => snapshot.context.lastError !== null
      }
    ],
    reachable: ['#cart.done']
  });
  ```

- `coverage.temporal.counts` reports, per property, how many runs satisfied
  it, failed it, and were inconclusive. `coverage.temporal.warnings` lists
  bounded properties whose `within` exceeds the longest sequence, which can
  never fail; `formatTestCoverage()` prints them.
- `pick(select, toPayload?)` builds an event case whose payload is picked from
  the current snapshot, with the snapshot type inferred from the machine. The
  case is skipped when there is nothing to pick, and a failing run shrinks
  towards the first candidate.

  ```ts
  import { pick } from '@xstate/test';

  events: {
    REMOVE: pick(
      (snapshot) => Object.keys(snapshot.context.items),
      (sku) => ({ sku })
    )
  }
  ```

- `@xstate/test/vitest` exports `it` and `test` with `.model` and `.paths`,
  and `withModelTests()`. Model tests save failures keyed by the test, set
  the timeout from `until.timeMs`, and print the coverage report on failure.
  `it.model.fails` passes only when the campaign fails with a matching
  message.

  ```ts
  import { it } from '@xstate/test/vitest';

  it.model('the cart matches the model', cartMachine, { events, sut: cartSut });
  it.model.fails('finds the remove bug', cartMachine, buggyOptions, {
    message: /Property observation diverged/
  });
  ```

- `createPlaywrightSut()` checks page oracles after every stable step:
  uncaught exceptions, console errors, unhandled rejections, and responses
  with a status of 400 or above, except responses to mocked routes. Configure
  them with `oracles`. With `testInfo`, it records a trace per run and
  attaches the failing run's trace, a screenshot, and `fixture.json`. `step`
  wraps each event action, such as in `test.step`. The default `settle` now
  waits for `waitForLoadState('load')` instead of `'networkidle'`.

  ```ts
  sut: createPlaywrightSut(page, {
    events,
    read,
    projectModel,
    testInfo,
    step: (name, body) => test.step(name, body),
    oracles: { pageError: true, console: 'warn', http: 500 }
  });
  ```

- `reporter` and `asyncReporter` are called with fast-check's run details,
  and `verbose` appends fast-check's report to the failure message.
- `statistics: true` prints `formatTestStatistics(coverage)` after a passing
  campaign: the share of executed events per event case and the share of runs
  per label. Shrink attempts are left out of `labels` and `eventCases`, and
  counted in `coverage.exploration.shrinkRuns`.
- SUT sessions can implement `check()`, run after every stable step, and
  receive `{ passed, failure }` in `dispose()`. A `sut` can implement
  `complete()`, called once when the campaign ends.
