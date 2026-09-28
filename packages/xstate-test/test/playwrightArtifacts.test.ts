import * as fc from 'fast-check';
import type { SnapshotFrom } from 'xstate';
import { createMachine, types } from 'xstate';
import { ModelTestFailure, propertyTest } from '../src/index.ts';
import {
  PlaywrightOracleError,
  createPlaywrightSut,
  type PlaywrightSutConfig
} from '../src/playwright.ts';
import { FakePage, FakeTestInfo } from './fakePage.ts';

const counterMachine = createMachine({
  id: 'counter',
  schemas: {
    context: types<{ count: number }>(),
    events: { INC: types<{ value: number }>(), RESET: types<{}>() }
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

const events = {
  INC: fc.record({ value: fc.integer({ min: 1, max: 3 }) }),
  RESET: fc.constant({})
};

function sutFor(
  page: FakePage,
  config: Partial<
    PlaywrightSutConfig<FakePage, CounterSnapshot, CounterEvent>
  > = {}
) {
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
    ...config
  });
}

async function catchFailure(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    return error as ModelTestFailure;
  }
  throw new Error('Expected the campaign to fail');
}

const campaign = { seed: 1, numRuns: 30, maxCommands: 5, events };

describe('page oracles', () => {
  it('fails on a console error by default, with the messages in the cause', async () => {
    const page = new FakePage();
    const failure = await catchFailure(() =>
      propertyTest(counterMachine, {
        ...campaign,
        sut: sutFor(page, {
          events: {
            INC: async (p, event) => {
              await p.fill('#amount', String(event.value));
              if (p.app.count >= 4) {
                p.emitConsole('error', `count is ${p.app.count}`);
              }
            },
            RESET: async (p) => {
              await p.click('#reset');
            }
          }
        })
      })
    );
    expect(failure).toBeInstanceOf(ModelTestFailure);
    expect(failure.summary).toMatch(/^SUT check failed after \d+ steps$/);
    expect(failure.cause).toBeInstanceOf(PlaywrightOracleError);
    expect((failure.cause as PlaywrightOracleError).messages).toEqual([
      expect.stringMatching(/^console\.error: count is [4-6]$/)
    ]);
    expect(failure.message).toContain('The page reported 1 error:');
    // Every session removed its listeners.
    expect(page.listenerCount('console')).toBe(0);
  });

  it('collects page errors, rejections, and HTTP errors, but not mocked responses', async () => {
    const page = new FakePage();
    const sut = sutFor(page, {
      mocks: {
        INC: (p) => p.route('**/api', (route) => route.fulfill({ status: 500 }))
      }
    });
    const session = await sut.create({} as never);
    expect(page.initScripts).toHaveLength(1);
    await session.send({ type: 'INC', value: 1 }, { snapshot: undefined! });
    page.emitResponse(500, '/api', page.routedRequests[0]);
    await session.check!();

    page.emit('pageerror', new Error('kaboom'));
    page.emitConsole('error', '[xstate-test] unhandledrejection: nope');
    page.emitConsole('warning', 'ignored at the default level');
    page.emitResponse(404, '/missing');
    await expect(session.check!()).rejects.toMatchObject({
      messages: [
        'pageerror: kaboom',
        'unhandledrejection: nope',
        'HTTP 404 GET /missing'
      ]
    });
    await session.dispose!({ passed: true });

    // The init script is installed once per SUT.
    await (
      await sut.create({} as never)
    ).dispose!({ passed: true });
    expect(page.initScripts).toHaveLength(1);
  });

  it('checks only the oracles an object turns on', async () => {
    const page = new FakePage();
    const session = await sutFor(page, {
      oracles: { console: 'warn', http: 500 }
    }).create({} as never);
    page.emit('pageerror', new Error('ignored'));
    page.emitResponse(404, '/ignored');
    page.emitConsole('warning', 'careful');
    page.emitResponse(503, '/down');
    await expect(session.check!()).rejects.toMatchObject({
      messages: ['console.warning: careful', 'HTTP 503 GET /down']
    });
    expect(page.initScripts).toEqual([]);
  });

  it('registers nothing with oracles: false', async () => {
    const page = new FakePage();
    await sutFor(page, { oracles: false }).create({} as never);
    expect(page.listenerCount('console')).toBe(0);
  });
});

describe('failure artifacts', () => {
  const brokenAt4 = {
    INC: async (p: FakePage, event: { value: number }) => {
      await p.fill(
        '#amount',
        String(p.app.count >= 3 ? event.value + 1 : event.value)
      );
    },
    RESET: async (p: FakePage) => {
      await p.click('#reset');
    }
  };

  it('attaches the fixture, the trace, and a screenshot of the failing run', async () => {
    const page = new FakePage();
    const testInfo = new FakeTestInfo();
    const failure = await catchFailure(() =>
      propertyTest(counterMachine, {
        ...campaign,
        sut: sutFor(page, { testInfo, events: brokenAt4 })
      })
    );
    const starts = page.tracingLog.filter((entry) => entry.startsWith('start'));
    expect(starts[0]).toBe('start {"screenshots":true,"snapshots":true}');
    expect(starts).toHaveLength(failure.coverage!.exploration.attemptedRuns);
    expect(page.tracingLog).toContain('stop (discarded)');
    expect(page.tracingLog).toContain(
      'stop test-results/xstate-test-failure-trace.zip'
    );
    expect(testInfo.attachments.map(({ name }) => name)).toEqual([
      'fixture.json',
      'trace',
      'failure.png'
    ]);
    const [fixture, trace, screenshot] = testInfo.attachments;
    expect(JSON.parse(fixture.body as string)).toEqual(failure.fixture);
    expect(trace).toMatchObject({
      path: 'test-results/xstate-test-failure-trace.zip',
      contentType: 'application/zip'
    });
    expect(screenshot.contentType).toBe('image/png');
  });

  it('attaches one screenshot per step of the failing run with every-step', async () => {
    const page = new FakePage();
    const testInfo = new FakeTestInfo();
    const failure = await catchFailure(() =>
      propertyTest(counterMachine, {
        ...campaign,
        sut: sutFor(page, {
          testInfo,
          trace: 'off',
          screenshots: 'every-step',
          events: brokenAt4
        })
      })
    );
    // The initial step and every event but the one that diverged.
    expect(testInfo.attachments.map(({ name }) => name)).toEqual([
      'fixture.json',
      ...failure.trace.steps.map((_, index) => `step-${index}.png`)
    ]);
    expect(page.tracingLog).toEqual([]);
  });

  it("attaches the last run's trace of a passing campaign with trace: 'on'", async () => {
    const page = new FakePage();
    const testInfo = new FakeTestInfo();
    await propertyTest(counterMachine, {
      ...campaign,
      numRuns: 3,
      sut: sutFor(page, { testInfo, trace: 'on' })
    });
    expect(testInfo.attachments).toEqual([
      {
        name: 'trace',
        path: 'test-results/xstate-test-trace.zip',
        contentType: 'application/zip'
      }
    ]);
  });

  it('requires testInfo for trace and screenshots', () => {
    expect(() => sutFor(new FakePage(), { trace: 'on' })).toThrow(/testInfo/);
  });

  it('wraps each event action in step', async () => {
    const page = new FakePage();
    const steps: string[] = [];
    const session = await sutFor(page, {
      step: async (name, body) => {
        steps.push(name);
        await body();
      }
    }).create({} as never);
    await session.send({ type: 'INC', value: 2 }, { snapshot: undefined! });
    await session.send({ type: 'RESET' }, { snapshot: undefined! });
    expect(steps).toEqual(['INC {"value":2}', 'RESET']);
    expect(page.app.count).toBe(0);
  });

  it("settles with waitForLoadState('load')", async () => {
    const page = new FakePage();
    const session = await sutFor(page).create({} as never);
    await session.settle!();
    expect(page.loadStates).toEqual(['load']);
  });
});
