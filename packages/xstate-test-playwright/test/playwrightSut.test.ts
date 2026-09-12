import type { SnapshotFrom } from 'xstate';
import { createMachine, types } from 'xstate';
import { PropertyTestFailure, propertyTest } from 'xstate/graph';
import {
  createPlaywrightSut,
  createPlaywrightTestModelSession
} from '../src/index.ts';
import { FakePage } from './fakePage.ts';
import {
  constant,
  integer,
  randomAdapter,
  record
} from './propertyTestAdapter.ts';

const counterMachine = createMachine({
  schemas: {
    context: types<{ count: number }>(),
    events: {
      INC: types<{ value: number }>(),
      RESET: types<{}>()
    }
  },
  context: { count: 0 },
  on: {
    INC: ({ context, event }) => ({
      context: { count: context.count + event.value }
    }),
    RESET: () => ({ context: { count: 0 } })
  }
});

type CounterSnapshot = SnapshotFrom<typeof counterMachine>;
type CounterEvent = { type: 'INC'; value: number } | { type: 'RESET' };

function sutFor(page: FakePage) {
  return createPlaywrightSut<FakePage, CounterSnapshot, CounterEvent>(page, {
    events: {
      INC: async (p, event) => {
        await p.fill('#amount', String(event.value));
      },
      RESET: async (p) => {
        await p.click('#reset');
      }
    },
    read: async (p) => Number(await p.locator('#count').textContent()),
    projectModel: (snapshot) => snapshot.context.count,
    reset: async (p) => {
      await p.click('#reset');
    }
  });
}

const adapter = randomAdapter({ seed: 3, numRuns: 10, maxCommands: 6 });
const events = {
  INC: record({ value: integer(1, 3) }),
  RESET: constant({})
};

describe('createPlaywrightSut', () => {
  it('passes when the page matches the model', async () => {
    const page = new FakePage();
    const result = await propertyTest(counterMachine, {
      adapter,
      events,
      sut: sutFor(page),
      invariant: () => {}
    });

    expect(result.coverage.runs).toBe(10);
    expect(page.loadStates).toContain('networkidle');
  });

  it('reports a divergence naming the step for a broken page', async () => {
    const page = new FakePage({ broken: true });
    let failure!: PropertyTestFailure;
    try {
      await propertyTest(counterMachine, {
        adapter,
        events,
        sut: sutFor(page),
        invariant: () => {}
      });
    } catch (error) {
      failure = error as PropertyTestFailure;
    }

    expect(failure).toBeInstanceOf(PropertyTestFailure);
    expect(failure.message).toMatch(/diverged/);
    const lastStep = failure.trace.steps.at(-1)!;
    expect(lastStep.event.type).toBe('INC');
    expect(failure.trace.finalObservation?.sut).toMatchObject({
      model: expect.any(Number),
      observed: expect.any(Number)
    });
  });

  it('advances page time through the Playwright clock', async () => {
    const page = new FakePage({ latency: 5 });
    const result = await propertyTest(counterMachine, {
      adapter: randomAdapter({ seed: 1, numRuns: 5, maxCommands: 4 }),
      events,
      commands: { advance: constant(5) },
      sut: createPlaywrightSut<FakePage, CounterSnapshot, CounterEvent>(page, {
        events: {
          INC: async (p, event) => {
            await p.fill('#amount', String(event.value));
            await p.clock.runFor(5);
          },
          RESET: async (p) => {
            await p.click('#reset');
          }
        },
        read: async (p) => Number(await p.locator('#count').textContent()),
        projectModel: (snapshot) => snapshot.context.count,
        reset: async (p) => {
          await p.click('#reset');
        }
      }),
      invariant: () => {}
    });

    expect(result.coverage.runs).toBe(5);
  });

  it('writes checkpoint screenshots and applies per-case mocks', async () => {
    const page = new FakePage();
    const sut = createPlaywrightSut<FakePage, CounterSnapshot, CounterEvent>(
      page,
      {
        events: {
          INC: async (p, event) => {
            await p.fill('#amount', String(event.value));
          },
          RESET: async (p) => {
            await p.click('#reset');
          }
        },
        read: async (p) => Number(await p.locator('#count').textContent()),
        projectModel: (snapshot) => snapshot.context.count,
        screenshotDir: 'shots',
        mocks: {
          INC: async (p) => {
            await p.route('**/api/increment', (route) =>
              route.fulfill({ status: 200 })
            );
          }
        }
      }
    );

    const session = await sut.create({
      logic: counterMachine as never,
      input: undefined,
      snapshot: undefined,
      label: () => {},
      classify: () => {},
      target: () => {}
    });
    await session.send({ type: 'INC', value: 2 });
    await session.send({ type: 'INC', value: 1 });
    await session.checkpoint!('after inc');

    expect(page.routes).toEqual(['**/api/increment']);
    expect(page.screenshots).toEqual(['shots/after-inc.png']);
    expect(await session.read()).toBe(3);
  });

  it('throws for an event with no configured action', async () => {
    const page = new FakePage();
    const sut = createPlaywrightSut<FakePage, CounterSnapshot, CounterEvent>(
      page,
      {
        events: {},
        read: async (p) => Number(await p.locator('#count').textContent()),
        projectModel: (snapshot) => snapshot.context.count
      }
    );
    const session = await sut.create({
      logic: counterMachine as never,
      input: undefined,
      snapshot: undefined,
      label: () => {},
      classify: () => {},
      target: () => {}
    });

    await expect(session.send({ type: 'RESET' })).rejects.toThrow(
      /No Playwright action configured for event "RESET"/
    );
  });
});

describe('createPlaywrightTestModelSession', () => {
  it('runs events and state assertions against the page', async () => {
    const page = new FakePage();
    const result = await propertyTest(counterMachine, {
      adapter,
      events,
      test: createPlaywrightTestModelSession<
        FakePage,
        CounterSnapshot,
        CounterEvent
      >(page, {
        events: {
          INC: async (p, step) => {
            await p.fill('#amount', String(step.event.value));
          },
          RESET: async (p) => {
            await p.click('#reset');
          }
        },
        states: {
          '*': async (p, snapshot) => {
            const text = await p.locator('#count').textContent();
            expect(Number(text)).toBe(snapshot.context.count);
          }
        },
        reset: async (p) => {
          await p.click('#reset');
        }
      }),
      invariant: () => {}
    });

    expect(result.coverage.runs).toBe(10);
  });

  it('fails when the page disagrees with the model', async () => {
    const page = new FakePage({ broken: true });
    await expect(
      propertyTest(counterMachine, {
        adapter,
        events,
        test: createPlaywrightTestModelSession<
          FakePage,
          CounterSnapshot,
          CounterEvent
        >(page, {
          events: {
            INC: async (p, step) => {
              await p.fill('#amount', String(step.event.value));
            },
            RESET: async (p) => {
              await p.click('#reset');
            }
          },
          states: {
            '*': async (p, snapshot) => {
              const text = await p.locator('#count').textContent();
              expect(Number(text)).toBe(snapshot.context.count);
            }
          }
        }),
        invariant: () => {}
      })
    ).rejects.toBeInstanceOf(PropertyTestFailure);
  });
});

describe('per-case mocks', () => {
  /** Counts how often each mock was installed across a whole campaign. */
  function mockingSutFor(page: FakePage, applied: string[]) {
    return createPlaywrightSut<FakePage, CounterSnapshot, CounterEvent>(page, {
      events: {
        INC: async (p, event) => {
          await p.fill('#amount', String(event.value));
        },
        RESET: async (p) => {
          await p.click('#reset');
        }
      },
      read: async (p) => Number(await p.locator('#count').textContent()),
      projectModel: (snapshot) => snapshot.context.count,
      reset: async (p) => {
        await p.click('#reset');
      },
      mocks: {
        'INC.small': async (p) => {
          applied.push('INC.small');
          await p.route('**/api/small', (route) =>
            route.fulfill({ status: 200 })
          );
        },
        'INC.large': async (p) => {
          applied.push('INC.large');
          await p.route('**/api/large', (route) =>
            route.fulfill({ status: 200 })
          );
        }
      }
    });
  }

  const casedEvents = {
    INC: [
      { case: 'small', generate: record({ value: constant(1) }) },
      { case: 'large', generate: record({ value: constant(3) }) }
    ],
    RESET: constant({})
  };

  it('resolves mocks by the generated event case', async () => {
    const page = new FakePage();
    const applied: string[] = [];
    await propertyTest(counterMachine, {
      adapter: randomAdapter({ seed: 2, numRuns: 8, maxCommands: 6 }),
      events: casedEvents as any,
      sut: mockingSutFor(page, applied),
      invariant: () => {}
    });

    expect(applied).toContain('INC.small');
    expect(applied).toContain('INC.large');
  });

  it('does not accumulate route handlers across sessions', async () => {
    const page = new FakePage();
    const applied: string[] = [];
    await propertyTest(counterMachine, {
      adapter: randomAdapter({ seed: 2, numRuns: 8, maxCommands: 6 }),
      events: casedEvents as any,
      sut: mockingSutFor(page, applied),
      invariant: () => {}
    });

    expect(applied.length).toBeGreaterThan(1);
    // Every route a mock installed is unrouted when its session is disposed.
    expect(page.installedRoutes).toEqual([]);
  });
});
