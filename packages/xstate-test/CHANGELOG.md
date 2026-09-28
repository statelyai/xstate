# @xstate/test

## 2.0.0-alpha.1

### Major Changes

- 97e9166: `@xstate/test` 2.0 is model-based and property-based testing for XState v6,
  built on fast-check. A state machine is the model: `@xstate/test` generates
  event sequences from it, sends each sequence to the machine and to the system
  under test (SUT), and fails when the two disagree or a declared property stops
  holding. All exports are experimental. `xstate` and `fast-check` are required
  peer dependencies.
  
  `propertyTest()` generates random event sequences and shrinks a failing one to
  a minimal counterexample. fast-check options (`seed`, `numRuns`,
  `maxCommands`, …) are top-level options:
  
  ```ts
  import * as fc from 'fast-check';
  import { propertyTest } from '@xstate/test';
  
  await propertyTest(cartMachine, {
    numRuns: 100,
    events: {
      ADD: fc.record({ sku: fc.constantFrom('apple', 'pear') }),
      CHECKOUT: fc.constant({})
    },
    sut: {
      create: () => {
        const cart = createCart();
        return {
          send: (event) => {
            if (event.type === 'ADD') cart.add(event.sku);
          },
          read: () => cart.items()
        };
      },
      projectModel: (snapshot) => snapshot.context.items
    },
    invariant: ({ snapshot }) => {
      expect(Object.values(snapshot.context.items).every((n) => n > 0)).toBe(true);
    }
  });
  ```
  
  `testPaths()` walks the machine's state graph and runs every path it finds. It
  takes the same `events`, `sut`, `states`, `invariant`, and `reference` options:
  
  ```ts
  import { testPaths } from '@xstate/test';
  
  await testPaths(cartMachine, { pathGenerator: 'simple', events, sut: cartSut });
  ```
  
  `pick()` builds an event case whose payload comes from the current snapshot.
  The case is skipped when there is nothing to pick:
  
  ```ts
  import { pick } from '@xstate/test';
  
  await propertyTest(cartMachine, {
    events: {
      REMOVE: pick(
        (snapshot) => Object.keys(snapshot.context.items),
        (sku) => ({ sku })
      )
    },
    sut: cartSut
  });
  ```
  
  A failure throws `ModelTestFailure`, with the trace, the fast-check seed, and a
  JSON-safe `fixture`. `replayTest()` replays a fixture without generating
  anything. `failures: true` saves failing fixtures to `.xstate-test` and replays
  them before the next campaign:
  
  ```ts
  import { ModelTestFailure, replayTest } from '@xstate/test';
  
  await expect(
    replayTest(cartMachine, fixture, { sut: cartSut })
  ).rejects.toBeInstanceOf(ModelTestFailure);
  
  await propertyTest(cartMachine, { events, sut: cartSut, failures: true });
  ```
  
  Both functions resolve with a `coverage` object: state nodes, transitions,
  transition pairs, event types, `meta.requirements`, labels, and temporal
  properties. `formatTestCoverage()` renders it as text or markdown;
  `formatTestCoverageJUnit()`, `formatTestCoverageHTML()`, and
  `testCoverageToJSON()` export it; `assertTestCoverage()` enforces thresholds:
  
  ```ts
  import { assertTestCoverage, formatTestCoverage } from '@xstate/test';
  
  const { coverage } = await propertyTest(cartMachine, { events, sut: cartSut });
  console.log(formatTestCoverage(coverage));
  assertTestCoverage(coverage, { transitions: 1, stateNodes: 1 });
  ```
  
  `generateTestSuite()` keeps a small set of fixtures from a passing campaign
  that preserves its coverage. `serializeTestSuite()` and `parseTestSuite()`
  store it, and `describeTestSuite()` registers one test per fixture:
  
  ```ts
  import { describeTestSuite, generateTestSuite } from '@xstate/test';
  
  const suite = await generateTestSuite(cartMachine, {
    seed: 1,
    numRuns: 200,
    events,
    sut: cartSut
  });
  describeTestSuite(suite, cartMachine, { invariant: () => {}, sut: cartSut });
  ```
  
  `@xstate/test/vitest` registers a model test in one call. `it.model` runs
  `propertyTest()` and `it.paths` runs `testPaths()`; failures are saved per
  test:
  
  ```ts
  import { it } from '@xstate/test/vitest';
  
  it.model('the cart matches the model', cartMachine, { events, sut: cartSut });
  ```
  
  `@xstate/test/playwright` provides `createPlaywrightSut()`, a `sut` that drives
  a Playwright page:
  
  ```ts
  import { createPlaywrightSut } from '@xstate/test/playwright';
  
  await propertyTest(formMachine, {
    events,
    sut: createPlaywrightSut(page, {
      reset: async (page) => {
        await page.goto('/');
      },
      events: { NEXT: (page) => page.click('#next') },
      read: async (page) => ({ step: await page.locator('#step').textContent() }),
      projectModel: (snapshot) => ({ step: String(snapshot.value) })
    })
  });
  ```
  
  Event generators are derived from the machine's `schemas.events` for every
  event type `events` does not configure. Zod schemas are supported directly,
  and Effect Schemas through `@xstate/test/effect-schema`. Pass
  `deriveEvents: false` to turn this off:
  
  ```ts
  import * as z from 'zod';
  
  const counterMachine = createMachine({
    schemas: { events: { INC: z.object({ by: z.number().int().min(1).max(5) }) } },
    context: { count: 0 },
    on: {
      INC: ({ context, event }) => ({ context: { count: context.count + event.by } })
    }
  });
  
  await propertyTest(counterMachine, {
    invariant: ({ snapshot }) => {
      expect(snapshot.context.count).toBeGreaterThanOrEqual(0);
    }
  });
  ```
