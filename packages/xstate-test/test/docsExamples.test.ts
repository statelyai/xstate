/**
 * Runs the code examples in `packages/xstate-test/README.md`. Each `it` is
 * named after the README section its snippet comes from, so a failure here
 * points at the section that went stale.
 */
import * as Schema from 'effect/Schema';
import * as fc from 'fast-check';
import {
  createAsyncLogic,
  createMachine,
  initialTransition,
  setup,
  transition,
  types,
  type EventFrom,
  type SnapshotFrom
} from 'xstate';
import {
  describeTestSuite as describeTestSuiteFromGraph,
  parseTestSuite as parseTestSuiteFromGraph
} from 'xstate/graph';
import * as z from 'zod';
import {
  ModelTestFailure,
  ReplayNotReproducedError,
  assertTestCoverage,
  checkLinearizable,
  createTestModel,
  eventsFromSchemas,
  formatTestCoverage,
  formatTestCoverageHTML,
  formatTestCoverageJUnit,
  fromTestParam,
  generateTestSuite,
  getCurrentScheduler,
  mergeEventGenerators,
  propertyTest,
  replayTest,
  runParallelPropertyCommands,
  serializeTestSuite,
  testCoverageToJSON,
  testPaths,
  withScheduledSut,
  type TestFixture,
  type TestSut
} from '../src/index.ts';
import { fromEffectSchemas } from '../src/effect-schema.ts';
import { createPlaywrightSut } from '../src/playwright.ts';

// ---------------------------------------------------------------- Quick start

const cartMachine = createMachine({
  id: 'cart',
  schemas: {
    context: types<{ items: Record<string, number> }>(),
    events: {
      ADD: types<{ sku: string }>(),
      REMOVE: types<{ sku: string }>(),
      CHECKOUT: types<{}>()
    }
  },
  context: { items: {} },
  initial: 'shopping',
  states: {
    shopping: {
      on: {
        ADD: ({ context, event }) => ({
          context: {
            items: {
              ...context.items,
              [event.sku]: (context.items[event.sku] ?? 0) + 1
            }
          }
        }),
        REMOVE: ({ context, event }) => {
          const { [event.sku]: _removed, ...items } = context.items;
          return { context: { items } };
        },
        CHECKOUT: ({ context }) =>
          Object.keys(context.items).length
            ? { target: 'checkedOut' }
            : undefined
      }
    },
    checkedOut: { type: 'final' }
  }
});

function createCart({ buggy = false } = {}) {
  const items: Record<string, number> = {};
  return {
    add: (sku: string) => {
      items[sku] = (items[sku] ?? 0) + 1;
    },
    remove: (sku: string) => {
      if (buggy && sku in items) {
        items[sku] = 0;
        return;
      }
      delete items[sku];
    },
    items: () => ({ ...items })
  };
}

const sku = fc.constantFrom('apple', 'pear');
const events = {
  ADD: fc.record({ sku }),
  REMOVE: fc.record({ sku }),
  CHECKOUT: fc.constant({})
};

function createCartSut({ buggy = false } = {}): TestSut<
  SnapshotFrom<typeof cartMachine>,
  EventFrom<typeof cartMachine>
> {
  return {
    create: () => {
      const cart = createCart({ buggy });
      return {
        send: (event) => {
          if (event.type === 'ADD') {
            cart.add(event.sku);
          }
          if (event.type === 'REMOVE') {
            cart.remove(event.sku);
          }
        },
        read: () => cart.items()
      };
    },
    projectModel: (snapshot) => snapshot.context.items
  };
}

const cartSut = createCartSut();

/** The dimension lines of a formatted report, as pasted in the README. */
function dimensionLines(report: string): string[] {
  return report.split('\n').filter((line) => / covered \(/.test(line));
}

describe('README: Quick start', () => {
  it('Generate random sequences with propertyTest()', async () => {
    const { coverage } = await propertyTest(cartMachine, {
      seed: 1,
      numRuns: 100,
      events,
      sut: cartSut
    });
    const report = formatTestCoverage(coverage);

    expect(dimensionLines(report).slice(0, 6)).toEqual([
      'states: 2/2 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown',
      'stateNodes: 3/3 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown',
      'configurations: 2/2 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown',
      'statuses: 2/2 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown',
      'eventTypes: 4/4 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown',
      'transitions: 3/3 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown'
    ]);
    expect(report).toContain(
      '  - ADD / default: 154 generated, 115 applicable, 115 executed, 39 ignored\n' +
        '  - CHECKOUT / default: 170 generated, 126 applicable, 126 executed, 44 ignored\n' +
        '  - REMOVE / default: 147 generated, 112 applicable, 112 executed, 35 ignored'
    );
  });

  it('Walk the state graph with testPaths()', async () => {
    const { coverage, results } = await testPaths(cartMachine, {
      pathGenerator: 'simple',
      events,
      sut: cartSut,
      stopWhen: (snapshot) =>
        Object.values(snapshot.context.items).some((qty) => qty >= 2)
    });

    expect(results).toHaveLength(15);
    expect(dimensionLines(formatTestCoverage(coverage)).slice(0, 6)).toEqual([
      'states: 2/2 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown',
      'stateNodes: 3/3 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown',
      'configurations: 2/2 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown',
      'statuses: 2/2 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown',
      'eventTypes: 4/4 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown',
      'transitions: 3/3 covered (100.0%), 0 uncovered, 0 unreachable, 0 unknown'
    ]);

    // The README's claim: the default shortest paths never take `REMOVE`.
    const shortest = await testPaths(cartMachine, {
      events,
      sut: cartSut,
      stopWhen: (snapshot) =>
        Object.values(snapshot.context.items).some((qty) => qty >= 2)
    });
    expect(shortest.coverage.eventTypes.uncovered).toEqual(['REMOVE']);
  });
});

// ------------------------------------------------------------------- Concepts

describe('README: Concepts', () => {
  it('Events', async () => {
    const seen: string[] = [];
    await propertyTest(cartMachine, {
      seed: 1,
      numRuns: 20,
      events: {
        ADD: [
          { case: 'apple', generate: fc.constant({ sku: 'apple' }) },
          {
            case: 'known-sku',
            generate: fc.constantFrom('apple', 'pear'),
            resolve: ({ generated }) => ({ sku: generated as string }),
            when: ({ snapshot }) =>
              Object.keys(snapshot.context.items).length < 3
          }
        ]
      },
      sut: {
        create: () => ({
          send: (_event, context) => {
            seen.push(`${context.case?.type}.${context.case?.name}`);
          }
        })
      }
    });

    expect(new Set(seen)).toEqual(new Set(['ADD.apple', 'ADD.known-sku']));
  });

  it('Events: testPaths() offers unconfigured event types as bare events', async () => {
    const { coverage } = await testPaths(cartMachine, {
      events: { ADD: fc.record({ sku: fc.constant('apple') }) },
      stopWhen: (snapshot) =>
        Object.values(snapshot.context.items).some((qty) => qty >= 2)
    });
    expect(coverage.eventTypes.covered).toContain('CHECKOUT');
  });

  it('Events: a non-object payload fails the run', async () => {
    await expect(
      propertyTest(cartMachine, {
        seed: 1,
        numRuns: 5,
        events: { ADD: fc.constant('apple') as never }
      })
    ).rejects.toThrow(/ADD/);
  });

  it('The sut option', async () => {
    let created = 0;
    let disposed = 0;
    await propertyTest(cartMachine, {
      seed: 1,
      numRuns: 10,
      events,
      sut: {
        create: () => {
          created++;
          const cart = createCart();
          return {
            send: (event) => {
              if (event.type === 'ADD') {
                cart.add(event.sku);
              }
              if (event.type === 'REMOVE') {
                cart.remove(event.sku);
              }
            },
            read: () => cart.items(),
            dispose: () => {
              disposed++;
            }
          };
        },
        projectModel: (snapshot) => snapshot.context.items
      }
    });

    expect(created).toBe(10);
    expect(disposed).toBe(created);
  });

  it('Oracles: states keys match state values and ids on a test model', async () => {
    const hits = new Set<string>();
    await testPaths(createTestModel(cartMachine), {
      // A descriptor rather than a bare arbitrary: `testPaths()` samples bare
      // arbitraries into functions, and a map of functions next to `states`
      // without a `sut` is rejected as a pre-2.0 `TestParam`.
      events: {
        ADD: [{ case: 'apple', generate: fc.constant({ sku: 'apple' }) }]
      },
      stopWhen: (snapshot) =>
        Object.values(snapshot.context.items).some((qty) => qty >= 2),
      states: {
        shopping: () => {
          hits.add('shopping');
        },
        '#cart.checkedOut': () => {
          hits.add('checkedOut');
        }
      }
    });
    expect(hits).toEqual(new Set(['shopping', 'checkedOut']));
  });

  it("Oracles: '*' and meta.test run on a plain machine", async () => {
    const calls: string[] = [];
    const machine = createMachine({
      schemas: {
        meta: types<{
          test: (session: unknown, snapshot: { value: unknown }) => void;
        }>()
      },
      initial: 'idle',
      states: {
        idle: {
          on: { GO: { target: 'done' } },
          meta: {
            test: (session, snapshot) => {
              calls.push(`meta:${String(snapshot.value)}:${typeof session}`);
            }
          }
        },
        done: {}
      }
    });
    await testPaths(machine, {
      states: {
        '*': (snapshot) => {
          calls.push(`*:${String(snapshot.value)}`);
        }
      }
    });
    expect(calls).toContain('meta:idle:undefined');
    expect(calls).toContain('*:done');
  });
});

// -------------------------------------------------------------- How-to guides

const counterMachine = setup({
  schemas: {
    events: {
      INC: z.object({ by: z.number().int().min(1).max(5) }),
      RESET: z.object({})
    }
  }
}).createMachine({
  context: { count: 0 },
  on: {
    INC: ({ context, event }) => ({
      context: { count: context.count + event.by }
    }),
    RESET: () => ({ context: { count: 0 } })
  }
});

const orderMachine = setup({
  schemas: {
    events: { SUBMIT: types<{}>() }
  },
  actors: {
    chargeCard: createAsyncLogic({
      run: async (): Promise<{ id: string }> => {
        throw new Error('the real service must not run in tests');
      }
    })
  }
}).createMachine({
  id: 'order',
  initial: 'idle',
  states: {
    idle: { on: { SUBMIT: { target: 'charging' } } },
    charging: {
      invoke: {
        src: 'chargeCard',
        onDone: { target: 'confirmed' },
        onError: { target: 'declined' }
      },
      after: { 5000: { target: 'timedOut' } }
    },
    confirmed: { type: 'final' },
    declined: { on: { SUBMIT: { target: 'charging' } } },
    timedOut: { on: { SUBMIT: { target: 'charging' } } }
  }
});

describe('README: How-to guides', () => {
  it('Derive event generators from schemas', async () => {
    const byValues: number[] = [];
    await propertyTest(counterMachine, {
      seed: 1,
      numRuns: 30,
      invariant: ({ snapshot, event }) => {
        expect(snapshot.context.count).toBeGreaterThanOrEqual(0);
        if (event?.type === 'INC') {
          byValues.push(event.by);
        }
      }
    });
    expect(byValues.length).toBeGreaterThan(0);
    expect(
      byValues.every((by) => Number.isInteger(by) && by >= 1 && by <= 5)
    ).toBe(true);

    const merged: number[] = [];
    await propertyTest(counterMachine, {
      seed: 1,
      numRuns: 10,
      deriveEvents: false,
      events: mergeEventGenerators(eventsFromSchemas(counterMachine), {
        INC: fc.record({ by: fc.constant(1) })
      }),
      invariant: ({ event }) => {
        if (event?.type === 'INC') {
          merged.push(event.by);
        }
      }
    });
    expect(new Set(merged)).toEqual(new Set([1]));

    await propertyTest(counterMachine, {
      seed: 1,
      numRuns: 10,
      deriveEvents: false,
      events: fromEffectSchemas({
        INC: Schema.Struct({
          by: Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0)))
        }),
        RESET: Schema.Struct({})
      }),
      invariant: ({ snapshot }) => {
        expect(snapshot.context.count).toBeGreaterThanOrEqual(0);
      }
    });
  });

  it('Steer invoked services', async () => {
    const fixed = await propertyTest(orderMachine, {
      seed: 1,
      numRuns: 20,
      mode: 'executed',
      actors: {
        chargeCard: createAsyncLogic({ run: async () => ({ id: 'ch_1' }) })
      },
      events: { SUBMIT: fc.constant({}) }
    });
    expect(fixed.coverage.stateNodes.covered).toContain('order.confirmed');

    const generated = await propertyTest(orderMachine, {
      seed: 1,
      numRuns: 50,
      mode: 'executed',
      outcomes: {
        chargeCard: fc.oneof(
          fc.record({
            ok: fc.constant(true as const),
            output: fc.record({ id: fc.string() })
          }),
          fc.record({
            ok: fc.constant(false as const),
            error: fc.constant('declined')
          })
        )
      },
      events: { SUBMIT: fc.constant({}) }
    });
    expect(generated.coverage.stateNodes.covered).toEqual(
      expect.arrayContaining(['order.confirmed', 'order.declined'])
    );

    await expect(
      propertyTest(orderMachine, {
        outcomes: { chargeCard: fc.constant({ ok: true as const, output: 1 }) }
      })
    ).rejects.toThrow("require `mode: 'executed'`");

    const paths = await testPaths(orderMachine, {
      mode: 'executed',
      outcomes: {
        chargeCard: fc.constant({ ok: true as const, output: { id: 'ch_1' } })
      }
    });
    expect(paths.coverage.stateNodes.covered).toEqual(
      expect.arrayContaining([
        'order.confirmed',
        // No `ok: false` outcome is declared, so the error branch is
        // resolved with a synthesized failure.
        'order.declined',
        'order.timedOut'
      ])
    );

    const pure = await testPaths(orderMachine, {
      outcomes: {
        chargeCard: fc.constant({ ok: true as const, output: { id: 'ch_1' } })
      }
    });
    expect(pure.coverage.stateNodes.covered).toEqual(
      expect.arrayContaining(['order.confirmed', 'order.declined'])
    );
  });

  it('Test delayed transitions', async () => {
    const { coverage } = await propertyTest(orderMachine, {
      seed: 1,
      numRuns: 50,
      mode: 'executed',
      outcomes: {
        chargeCard: fc.constant({ ok: true as const, output: { id: 'ch_1' } })
      },
      events: { SUBMIT: fc.constant({}) },
      commands: { advance: fc.integer({ min: 1_000, max: 10_000 }) }
    });
    expect(coverage.stateNodes.covered).toContain('order.timedOut');

    const paths = await testPaths(orderMachine, { mode: 'executed' });
    expect(paths.coverage.stateNodes.covered).toContain('order.timedOut');
  });

  it('Test a web page with Playwright', async () => {
    const formMachine = createMachine({
      id: 'form',
      schemas: {
        context: types<{ name: string; error: string }>(),
        events: {
          FILL: types<{ value: string }>(),
          NEXT: types<{}>(),
          BACK: types<{}>()
        }
      },
      context: { name: '', error: '' },
      initial: 'name',
      states: {
        name: {
          on: {
            FILL: ({ event }) => ({
              context: { name: event.value, error: '' }
            }),
            NEXT: ({ context }) =>
              context.name
                ? { target: 'review', context: { error: '' } }
                : { context: { error: 'name is required' } }
          }
        },
        review: {
          on: { BACK: () => ({ target: 'name', context: { error: '' } }) }
        }
      }
    });
    const page = new FakeFormPage();

    await propertyTest(formMachine, {
      seed: 1,
      numRuns: 25,
      maxCommands: 8,
      events: {
        FILL: fc.record({
          value: fc.constantFrom('', 'Ada', 'ada@example.com')
        }),
        NEXT: fc.constant({}),
        BACK: fc.constant({})
      },
      sut: createPlaywrightSut(page, {
        reset: async (page) => {
          await page.goto('/');
        },
        events: {
          FILL: (page, event) => page.fill('#field', event.value),
          NEXT: (page) => page.click('#next'),
          BACK: (page) => page.click('#back')
        },
        read: async (page) => ({
          step: await page.locator('#step').textContent(),
          error: await page.locator('#error').textContent()
        }),
        projectModel: (snapshot) => ({
          step: String(snapshot.value),
          error: snapshot.context.error
        })
      })
    });
    expect(page.gotos).toBe(25);
    expect(page.loadStates.every((state) => state === 'networkidle')).toBe(
      true
    );
  });

  it('Test a web page with Playwright: mocks per case', async () => {
    const machine = createMachine({
      schemas: { events: { SUBMIT: types<{}>() } },
      on: { SUBMIT: {} }
    });
    const page = new FakeFormPage();
    const read = () => null;
    const projectModel = () => null;

    await propertyTest(machine, {
      seed: 1,
      numRuns: 10,
      events: {
        SUBMIT: [
          { case: 'ok', generate: fc.constant({}) },
          { case: 'error', generate: fc.constant({}) }
        ]
      },
      sut: createPlaywrightSut(page, {
        events: { SUBMIT: (page) => page.click('#submit') },
        mocks: {
          'SUBMIT.ok': (page) =>
            page.route('**/api/submit', (route: FakeRoute) =>
              route.fulfill({ status: 200 })
            ),
          'SUBMIT.error': (page) =>
            page.route('**/api/submit', (route: FakeRoute) =>
              route.fulfill({ status: 500 })
            )
        },
        read,
        projectModel
      })
    });
    expect(page.routes.length).toBeGreaterThan(0);
    // Every route a mock installed was removed again.
    expect(page.installed).toEqual([]);
  });

  it('Gate CI on coverage', async () => {
    const { coverage } = await propertyTest(cartMachine, {
      seed: 1,
      events,
      sut: cartSut
    });
    assertTestCoverage(coverage, { transitions: 1, stateNodes: 1 });

    const until = await propertyTest(cartMachine, {
      seed: 1,
      events,
      sut: cartSut,
      until: { transitions: 1 },
      maxRuns: 500
    });
    expect(until.coverage.exploration.stoppedBecause).toBe('until');

    expect(formatTestCoverage(coverage, { format: 'markdown' })).toContain('|');
    expect(JSON.stringify(testCoverageToJSON(coverage))).toContain(
      '"formatVersion":1'
    );
    expect(formatTestCoverageJUnit(coverage, { suiteName: 'cart' })).toContain(
      '<testcase'
    );
    expect(formatTestCoverageHTML(coverage, { title: 'Cart' })).toContain(
      '<title>Cart</title>'
    );

    const labelled = await propertyTest(cartMachine, {
      seed: 1,
      events,
      invariant: ({ snapshot, classify }) => {
        classify(Object.keys(snapshot.context.items).length >= 2, 'two-skus');
      },
      expectLabels: { 'two-skus': { min: 0.1 } }
    });
    expect(labelled.coverage.labels['two-skus'].share).toBeGreaterThanOrEqual(
      0.1
    );
  });

  it('Replay a failure', async () => {
    let failure!: ModelTestFailure;
    try {
      await propertyTest(cartMachine, {
        seed: 1,
        events,
        sut: createCartSut({ buggy: true })
      });
    } catch (error) {
      failure = error as ModelTestFailure;
    }
    expect(failure).toBeInstanceOf(ModelTestFailure);
    // The failure the docs page pastes: `REMOVE pear` leaves `pear` at zero.
    expect(failure.summary).toBe('Property observation diverged');
    expect(failure.message).toContain(
      [
        '2. generator REMOVE {"sku":"pear"} -> {"value":"shopping","context":{"items":{}}}',
        '   sut diverged',
        '     model:    {}',
        '     observed: {"pear":0}'
      ].join('\n')
    );
    expect(failure.message).toContain(
      'Reproduce: seed 1, path "1:2:1:2:3", replayPath "N:B"'
    );
    // The fixture is JSON-safe: round-trip it the way a committed file would.
    const fixture = JSON.parse(JSON.stringify(failure.fixture)) as TestFixture;

    await expect(
      replayTest(cartMachine, fixture, { sut: createCartSut({ buggy: true }) })
    ).rejects.toBeInstanceOf(ModelTestFailure);

    // With the bug fixed, the recorded failure no longer reproduces.
    await expect(
      replayTest(cartMachine, fixture, { sut: cartSut })
    ).rejects.toBeInstanceOf(ReplayNotReproducedError);
    await replayTest(cartMachine, fixture, { sut: cartSut, expect: 'pass' });

    await expect(
      propertyTest(cartMachine, {
        events,
        sut: createCartSut({ buggy: true }),
        seed: failure.replay!.seed,
        path: failure.replay!.path,
        replayPath: failure.replay!.replayPath
      })
    ).rejects.toBeInstanceOf(ModelTestFailure);
  });

  it('Record an offline regression suite', async () => {
    const suite = await generateTestSuite(cartMachine, {
      seed: 1,
      numRuns: 200,
      events,
      sut: cartSut
    });
    const json = serializeTestSuite(suite);
    const parsed = parseTestSuiteFromGraph(json);

    const registered: string[] = [];
    const bodies: (() => Promise<void> | void)[] = [];
    describeTestSuiteFromGraph(parsed, cartMachine, {
      invariant: () => {},
      sut: cartSut,
      it: (name, fn) => {
        registered.push(name);
        bodies.push(fn);
      },
      describe: (_name, fn) => fn()
    });
    expect(registered).toHaveLength(parsed.fixtures.length);
    for (const body of bodies) {
      await body();
    }
  });

  it('Test concurrency', async () => {
    // A counter whose writes land out of order under the scheduler.
    await expect(
      propertyTest(counterMachine, {
        seed: 1,
        numRuns: 50,
        scheduler: true,
        deriveEvents: false,
        events: { INC: fc.record({ by: fc.constant(1) }) },
        sut: withScheduledSut({
          create: () => {
            const scheduler = getCurrentScheduler()!;
            let count = 0;
            return {
              send: () => {
                void scheduler
                  .schedule(Promise.resolve(), 'commit')
                  .then(() => {
                    count++;
                  });
              },
              read: () => count
            };
          },
          projectModel: (snapshot) => snapshot.context.count
        })
      })
    ).rejects.toBeInstanceOf(ModelTestFailure);

    const result = checkLinearizable(
      [
        {
          id: 'a',
          invocation: { type: 'write', value: 1 },
          response: undefined,
          start: 0,
          end: 4
        },
        {
          id: 'b',
          invocation: { type: 'read' },
          response: 1,
          start: 1,
          end: 5
        }
      ],
      {
        initial: 0,
        apply: (state: number, event: { type: string; value?: number }) =>
          event.type === 'write'
            ? { state: event.value!, response: undefined }
            : { state, response: state }
      }
    );
    expect(result.linearizable).toBe(true);
    expect(result.witness?.map((entry) => entry.id)).toEqual(['a', 'b']);

    const parallel = await runParallelPropertyCommands(counterMachine, {
      prefix: [{ type: 'INC', by: 1 }],
      branches: [[{ type: 'INC', by: 1 }], [{ type: 'INC', by: 2 }]],
      sut: {
        create: () => {
          let count = 0;
          return {
            send: async (event) =>
              (count += event.type === 'INC' ? event.by : 0)
          };
        },
        projectModel: (snapshot) => snapshot.context.count
      }
    });
    expect(parallel.linearizable).toBe(true);
  });

  it('Steer exploration', async () => {
    const weighted = await propertyTest(cartMachine, {
      seed: 1,
      numRuns: 20,
      events: {
        ADD: { generate: fc.record({ sku }), weight: 5 },
        REMOVE: fc.record({ sku }),
        CHECKOUT: { generate: fc.constant({}), weight: 0.5 }
      }
    });
    const cases = weighted.coverage.eventCases;
    expect(Object.values(cases).map(({ weight }) => weight)).toEqual(
      expect.arrayContaining([5, 1, 0.5])
    );

    const model = createTestModel(cartMachine);
    const frontier = await propertyTest(model, {
      seed: 1,
      events,
      frontiers: {
        paths: model.getShortestPaths({
          toState: (snapshot) => Object.keys(snapshot.context.items).length > 0,
          stopWhen: (snapshot) =>
            Object.values(snapshot.context.items).some((qty) => qty >= 2)
        }),
        runsPerFrontier: 50
      }
    });
    expect(frontier.coverage.exploration.frontiers.length).toBeGreaterThan(0);

    const auto = await propertyTest(cartMachine, {
      seed: 1,
      events,
      frontiers: 'auto',
      until: { transitions: 1 },
      maxRuns: 200
    });
    expect(auto.coverage.exploration.stoppedBecause).toBe('until');

    const swarm = await propertyTest(cartMachine, {
      seed: 1,
      numRuns: 20,
      events,
      swarm: true
    });
    expect(swarm.coverage.exploration.swarm?.runs).toBeGreaterThan(0);

    const { coverage } = await propertyTest(cartMachine, {
      seed: 1,
      events,
      target: ({ snapshot }) => snapshot.context.items.apple ?? 0,
      frontiers: { strategy: 'target' },
      until: (coverage) => coverage.exploration.target.best >= 8,
      maxRuns: 400
    });
    expect(coverage.exploration.target.best).toBeGreaterThan(0);
  });

  it('Start from a snapshot or input', async () => {
    const [cartWithApple] = transition(
      cartMachine,
      initialTransition(cartMachine)[0],
      { type: 'ADD', sku: 'apple' }
    );

    const initialItems: unknown[] = [];
    await propertyTest(cartMachine, {
      seed: 1,
      numRuns: 5,
      events,
      start: {
        snapshot: cartWithApple,
        serializeSnapshot: (snapshot) => snapshot.context
      },
      invariant: ({ initialSnapshot }) => {
        initialItems.push(initialSnapshot.context.items);
      }
    });
    expect(initialItems[0]).toEqual({ apple: 1 });
  });
});

// ----------------------------------------------------------------- Migration

describe('README: Migrating from @xstate/test 0.x and 1.0 beta', () => {
  const signupMachine = createMachine({
    id: 'signup',
    schemas: { events: { SUBMIT: types<{}>() } },
    initial: 'editing',
    states: {
      editing: { on: { SUBMIT: { target: 'submitted' } } },
      submitted: {}
    }
  });

  it('From 1.0 beta', async () => {
    const clicked: string[] = [];
    const checked: string[] = [];
    const page = {
      click: async (selector: string) => {
        clicked.push(selector);
      }
    };

    const model = createTestModel(signupMachine);
    for (const path of model.getShortestPaths()) {
      await path.test({
        sut: {
          create: () => ({
            send: (event) =>
              event.type === 'SUBMIT' ? page.click('#submit') : undefined,
            states: {
              submitted: () => {
                checked.push('submitted');
              }
            }
          })
        }
      });
    }
    expect(clicked).toEqual(['#submit']);
    expect(checked).toEqual(['submitted']);

    const typedEvents: string[] = [];
    await testPaths(model, {
      sut: fromTestParam({
        events: {
          SUBMIT: ({ event }) => {
            typedEvents.push(event.type);
          }
        },
        states: {
          submitted: () => {
            checked.push('from-test-param');
          }
        }
      })
    });
    expect(typedEvents).toEqual(['SUBMIT']);
    expect(checked).toContain('from-test-param');
  });

  it('From 0.x', async () => {
    const skuMachine = createMachine({
      schemas: {
        context: types<{ skus: string[] }>(),
        events: { ADD: types<{ sku: string }>() }
      },
      context: { skus: [] },
      on: {
        ADD: ({ context, event }) =>
          context.skus.includes(event.sku)
            ? undefined
            : { context: { skus: [...context.skus, event.sku] } }
      }
    });
    const filled: string[] = [];
    const page = {
      fill: async (_selector: string, value: string) => {
        filled.push(value);
      }
    };

    await testPaths(skuMachine, {
      events: {
        ADD: [
          { case: 'apple', generate: fc.constant({ sku: 'apple' }) },
          { case: 'pear', generate: fc.constant({ sku: 'pear' }) }
        ]
      },
      samples: 1,
      sut: { create: () => ({ send: (event) => page.fill('#sku', event.sku) }) }
    });
    expect(new Set(filled)).toEqual(new Set(['apple', 'pear']));
  });
});

// ------------------------------------------------------- Playwright page fake

interface FakeRoute {
  fulfill: (response: { status: number }) => void;
}

/** A minimal in-memory stand-in for the Playwright `Page` the README drives. */
class FakeFormPage {
  public gotos = 0;
  public readonly loadStates: string[] = [];
  public readonly routes: string[] = [];
  public installed: unknown[] = [];
  private step = 'name';
  private name = '';
  private error = '';
  private field = '';

  public goto(_url: string): Promise<void> {
    this.gotos++;
    this.step = 'name';
    this.name = '';
    this.error = '';
    this.field = '';
    return Promise.resolve();
  }

  public fill(_selector: string, value: string): Promise<void> {
    this.field = value;
    if (this.step === 'name') {
      this.name = value;
      this.error = '';
    }
    return Promise.resolve();
  }

  public click(selector: string): Promise<void> {
    if (selector === '#next' && this.step === 'name') {
      if (this.name) {
        this.step = 'review';
        this.error = '';
      } else {
        this.error = 'name is required';
      }
    } else if (selector === '#back' && this.step === 'review') {
      this.step = 'name';
      this.error = '';
    }
    return Promise.resolve();
  }

  public locator(selector: string) {
    return {
      textContent: (): Promise<string | null> =>
        Promise.resolve(
          selector === '#step'
            ? this.step
            : selector === '#error'
              ? this.error
              : this.field
        )
    };
  }

  public waitForLoadState(state?: string): Promise<void> {
    this.loadStates.push(state ?? 'load');
    return Promise.resolve();
  }

  public route(
    url: string,
    handler: (route: FakeRoute) => void
  ): Promise<void> {
    this.routes.push(url);
    this.installed.push(handler);
    return Promise.resolve();
  }

  public unroute(_url: string, handler?: unknown): Promise<void> {
    this.installed = this.installed.filter((entry) => entry !== handler);
    return Promise.resolve();
  }
}
