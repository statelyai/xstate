import * as fc from 'fast-check';
import { createMachine, types } from 'xstate';
import {
  PropertyTestFailure,
  defaultEquivalent,
  propertyTest,
  replayPropertyTest,
  type PropertyTestAdapter
} from 'xstate/graph';
import { extractReplayPath, fastCheckAdapter } from '../src/index.ts';

const counterMachine = createMachine({
  id: 'p0-counter',
  schemas: {
    context: types<{ count: number }>(),
    events: { INC: types<{}>() }
  },
  context: { count: 0 },
  on: {
    INC: ({ context }) => ({ context: { count: context.count + 1 } })
  }
});

/**
 * Drives the runner directly so the number of executed commands (and the
 * number of rejected precondition checks) is exact.
 */
function scriptedAdapter(
  script: (runner: any, caseId: string) => Promise<void>
): PropertyTestAdapter {
  return {
    run: async (request: any) => {
      const runner = request.createRunner();
      const caseId = request.events[0]?.caseId;
      try {
        await runner.start();
        await script(runner, caseId);
        await runner.finish();
        return {
          runs: 1,
          exploration: { configuredRuns: 1, maximumSequenceLength: null }
        };
      } finally {
        await runner.dispose();
      }
    }
  } as PropertyTestAdapter;
}

describe('temporal operators (STA-6400)', () => {
  it('does not fail a bounded `eventually` whose `within` bound was never reached', async () => {
    const result = await propertyTest(counterMachine, {
      adapter: scriptedAdapter(async (runner, caseId) => {
        runner.canRun({ type: 'INC' }, caseId);
        await runner.run({ type: 'INC' }, caseId);
      }),
      events: { INC: undefined },
      temporal: [
        {
          type: 'eventually',
          id: 'reach-ten',
          // the run only produces 2 stable steps, so step 10 is never reached
          within: 10,
          predicate: ({ snapshot }) => snapshot.context.count === 10
        }
      ],
      invariant: () => {}
    });

    expect(result.coverage.temporalChecks).toBeGreaterThan(0);
  });

  it('does not fail a bounded `until` whose `within` bound was never reached', async () => {
    await expect(
      propertyTest(counterMachine, {
        adapter: scriptedAdapter(async (runner, caseId) => {
          runner.canRun({ type: 'INC' }, caseId);
          await runner.run({ type: 'INC' }, caseId);
        }),
        events: { INC: undefined },
        temporal: [
          {
            type: 'until',
            id: 'never-closes',
            within: 10,
            hold: () => true,
            until: () => false
          }
        ],
        invariant: () => {}
      })
    ).resolves.toBeDefined();
  });

  it('still fails an unbounded `eventually` that the run never satisfied', async () => {
    let failure!: PropertyTestFailure;
    try {
      await propertyTest(counterMachine, {
        adapter: scriptedAdapter(async (runner, caseId) => {
          runner.canRun({ type: 'INC' }, caseId);
          await runner.run({ type: 'INC' }, caseId);
        }),
        events: { INC: undefined },
        temporal: [
          {
            type: 'eventually',
            id: 'reach-ten-unbounded',
            predicate: ({ snapshot }) => snapshot.context.count === 10
          }
        ],
        invariant: () => {}
      });
    } catch (error) {
      failure = error as PropertyTestFailure;
    }

    expect(failure).toBeInstanceOf(PropertyTestFailure);
    expect(failure.fixture?.temporalFailure).toMatchObject({
      type: 'eventually',
      id: 'reach-ten-unbounded'
    });
    // unbounded temporal failures carry no `within`
    expect(failure.fixture?.temporalFailure?.within).toBeUndefined();
  });

  it('fails `always` on the first stable step where the predicate does not hold', async () => {
    let failure!: PropertyTestFailure;
    try {
      await propertyTest(counterMachine, {
        adapter: scriptedAdapter(async (runner, caseId) => {
          runner.canRun({ type: 'INC' }, caseId);
          await runner.run({ type: 'INC' }, caseId);
          runner.canRun({ type: 'INC' }, caseId);
          await runner.run({ type: 'INC' }, caseId);
        }),
        events: { INC: undefined },
        temporal: [
          {
            type: 'always',
            id: 'below-two',
            predicate: ({ snapshot }) => snapshot.context.count < 2
          }
        ],
        invariant: () => {}
      });
    } catch (error) {
      failure = error as PropertyTestFailure;
    }

    expect(failure).toBeInstanceOf(PropertyTestFailure);
    expect(failure.fixture?.temporalFailure).toMatchObject({
      type: 'always',
      id: 'below-two'
    });
    expect(failure.fixture?.temporalFailure?.within).toBeUndefined();
  });

  it('passes `always` when the predicate holds on every stable step', async () => {
    await expect(
      propertyTest(counterMachine, {
        adapter: scriptedAdapter(async (runner, caseId) => {
          runner.canRun({ type: 'INC' }, caseId);
          await runner.run({ type: 'INC' }, caseId);
        }),
        events: { INC: undefined },
        temporal: [
          {
            type: 'always',
            id: 'non-negative',
            predicate: ({ snapshot }) => snapshot.context.count >= 0
          }
        ],
        invariant: () => {}
      })
    ).resolves.toBeDefined();
  });

  it('fails `never` on the first stable step where the predicate holds', async () => {
    let failure!: PropertyTestFailure;
    try {
      await propertyTest(counterMachine, {
        adapter: scriptedAdapter(async (runner, caseId) => {
          runner.canRun({ type: 'INC' }, caseId);
          await runner.run({ type: 'INC' }, caseId);
        }),
        events: { INC: undefined },
        temporal: [
          {
            type: 'never',
            id: 'never-one',
            predicate: ({ snapshot }) => snapshot.context.count === 1
          }
        ],
        invariant: () => {}
      });
    } catch (error) {
      failure = error as PropertyTestFailure;
    }

    expect(failure).toBeInstanceOf(PropertyTestFailure);
    expect(failure.fixture?.temporalFailure).toMatchObject({
      type: 'never',
      id: 'never-one'
    });
  });

  it('passes `never` when the predicate never holds', async () => {
    await expect(
      propertyTest(counterMachine, {
        adapter: scriptedAdapter(async (runner, caseId) => {
          runner.canRun({ type: 'INC' }, caseId);
          await runner.run({ type: 'INC' }, caseId);
        }),
        events: { INC: undefined },
        temporal: [
          {
            type: 'never',
            id: 'never-negative',
            predicate: ({ snapshot }) => snapshot.context.count < 0
          }
        ],
        invariant: () => {}
      })
    ).resolves.toBeDefined();
  });
});

describe('non-object event payloads (STA-6402)', () => {
  it('throws a descriptive error for a non-object generated payload', async () => {
    await expect(
      propertyTest(counterMachine, {
        adapter: fastCheckAdapter({ seed: 1, numRuns: 1, maxCommands: 2 }),
        // `fc.integer()` produces a number, not an event payload object
        events: { INC: fc.integer({ min: 1, max: 3 }) as any },
        invariant: () => {}
      })
    ).rejects.toThrow(/non-object payload/);
  });

  it('names the event case and points at `resolve`', async () => {
    let message = '';
    try {
      await propertyTest(counterMachine, {
        adapter: fastCheckAdapter({ seed: 2, numRuns: 1, maxCommands: 2 }),
        events: { INC: fc.constant(7) as any },
        invariant: () => {}
      });
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain('INC');
    expect(message).toContain('7');
    expect(message).toContain('`resolve`');
  });

  it('throws when `resolve` itself returns a non-object payload', async () => {
    await expect(
      propertyTest(counterMachine, {
        adapter: fastCheckAdapter({ seed: 3, numRuns: 1, maxCommands: 2 }),
        events: {
          INC: {
            generate: fc.record({ value: fc.integer({ min: 1, max: 3 }) }),
            resolve: ({ generated }: any) => generated.value
          } as any
        },
        invariant: () => {}
      })
    ).rejects.toThrow(/non-object payload/);
  });

  it('throws when an adapter calls `createEvent` with a non-object payload', async () => {
    await expect(
      propertyTest(counterMachine, {
        adapter: {
          run: async (request: any) => {
            request.createEvent('INC', 42);
            return {
              runs: 1,
              exploration: { configuredRuns: 1, maximumSequenceLength: null }
            };
          }
        } as PropertyTestAdapter,
        events: { INC: undefined },
        invariant: () => {}
      })
    ).rejects.toThrow(/Property event "INC" generated a non-object payload/);
  });

  it('accepts an array-free plain object payload', async () => {
    await expect(
      propertyTest(counterMachine, {
        adapter: fastCheckAdapter({ seed: 4, numRuns: 5, maxCommands: 3 }),
        events: { INC: fc.record({}) },
        invariant: () => {}
      })
    ).resolves.toBeDefined();
  });

  it('rejects an array payload', async () => {
    await expect(
      propertyTest(counterMachine, {
        adapter: fastCheckAdapter({ seed: 5, numRuns: 1, maxCommands: 2 }),
        events: { INC: fc.constant([1, 2]) as any },
        invariant: () => {}
      })
    ).rejects.toThrow(/non-object payload/);
  });
});

describe('exploration metrics (STA-6403)', () => {
  it('counts executed commands only, not rejected precondition checks', async () => {
    const result = await propertyTest(counterMachine, {
      adapter: scriptedAdapter(async (runner, caseId) => {
        // six precondition checks, two executions
        runner.canRun({ type: 'INC' }, caseId);
        runner.canRun({ type: 'INC' }, caseId);
        runner.canRun({ type: 'INC' }, caseId);
        await runner.run({ type: 'INC' }, caseId);
        runner.canRun({ type: 'INC' }, caseId);
        runner.canRun({ type: 'INC' }, caseId);
        runner.canRun({ type: 'INC' }, caseId);
        await runner.run({ type: 'INC' }, caseId);
      }),
      events: { INC: undefined },
      invariant: () => {}
    });

    expect(result.coverage.exploration.maximumObservedSequenceLength).toBe(2);
  });

  it('reports `attemptedRuns` on the exploration output', async () => {
    const result = await propertyTest(counterMachine, {
      adapter: fastCheckAdapter({ seed: 7, numRuns: 5, maxCommands: 3 }),
      events: { INC: fc.record({}) },
      invariant: () => {}
    });

    expect(result.coverage.exploration.attemptedRuns).toBe(
      result.coverage.runs
    );
    expect(result.coverage.exploration.attemptedRuns).toBeGreaterThan(0);
    expect(
      result.coverage.exploration.frontiers.reduce(
        (total, frontier) => total + frontier.attemptedRuns,
        0
      )
    ).toBe(result.coverage.exploration.attemptedRuns);
  });
});

describe('replay (STA-6407)', () => {
  it('never masks the underlying failure with a fixture-construction error', async () => {
    let failure!: PropertyTestFailure;
    try {
      await propertyTest(counterMachine, {
        adapter: scriptedAdapter(async (runner, caseId) => {
          runner.canRun({ type: 'INC' }, caseId);
          await runner.run({ type: 'INC' }, caseId);
        }),
        events: { INC: undefined },
        start: {
          snapshot: counterMachine.getInitialSnapshot(undefined as any) as any,
          serializeSnapshot: () => {
            throw new Error('serializeSnapshot exploded');
          }
        },
        invariant: ({ snapshot }) => {
          if (snapshot.context.count > 0) {
            throw new Error('count must stay at zero');
          }
        }
      });
    } catch (error) {
      failure = error as PropertyTestFailure;
    }

    expect(failure).toBeInstanceOf(PropertyTestFailure);
    // the real cause survives; only the fixture is dropped
    expect((failure.cause as Error).message).toBe('count must stay at zero');
    expect(failure.fixture).toBeUndefined();
  });

  it('throws a plain error when a `start.serializeSnapshot` function is missing', async () => {
    await expect(
      propertyTest(counterMachine, {
        adapter: fastCheckAdapter({ seed: 8, numRuns: 1 }),
        events: { INC: fc.record({}) },
        start: {
          snapshot: counterMachine.getInitialSnapshot(undefined as any) as any
        } as any,
        invariant: () => {}
      })
    ).rejects.toThrow('start.serializeSnapshot');
  });

  it('reproduces a reference-oracle divergence when `reference` is passed through', async () => {
    const machine = createMachine({
      id: 'p0-reference',
      schemas: {
        context: types<{ count: number }>(),
        events: { ADD: types<{ value: number }>() }
      },
      context: { count: 0 },
      on: {
        ADD: ({ context, event }) => ({
          context: { count: context.count + event.value }
        })
      }
    });
    const reference = {
      create: () => {
        let count = 0;
        return {
          transition: (event: any) => {
            // deliberately wrong
            count += event.value + 1;
          },
          read: () => count
        };
      },
      projectModel: (snapshot: any) => snapshot.context.count
    };

    let failure!: PropertyTestFailure;
    try {
      await propertyTest(machine, {
        adapter: fastCheckAdapter({ seed: 9, numRuns: 20, maxCommands: 4 }),
        events: { ADD: fc.record({ value: fc.integer({ min: 1, max: 5 }) }) },
        reference,
        invariant: () => {}
      });
    } catch (error) {
      failure = error as PropertyTestFailure;
    }
    expect(failure).toBeInstanceOf(PropertyTestFailure);
    expect(failure.fixture).toBeDefined();

    // without the reference, the run is clean and replay reports non-reproduction
    await expect(
      replayPropertyTest(machine, failure.fixture!, { invariant: () => {} })
    ).rejects.toThrow(/did not reproduce the recorded failure/);

    // with the reference passed through, the divergence reproduces
    const replayFailure = await replayPropertyTest(machine, failure.fixture!, {
      invariant: () => {},
      reference
    }).catch((error) => error);
    expect(replayFailure).toBeInstanceOf(PropertyTestFailure);
    expect(replayFailure.cause).toMatchObject({ referenceMatches: false });
  });

  it('reproduces an SUT divergence when `sut` is passed through', async () => {
    const machine = createMachine({
      id: 'p0-sut',
      schemas: {
        context: types<{ count: number }>(),
        events: { ADD: types<{ value: number }>() }
      },
      context: { count: 0 },
      on: {
        ADD: ({ context, event }) => ({
          context: { count: context.count + event.value }
        })
      }
    });
    const sut = {
      create: () => {
        let count = 0;
        return {
          send: (event: any) => {
            // deliberately wrong
            count += event.value * 2;
          },
          read: () => count
        };
      },
      projectModel: (snapshot: any) => snapshot.context.count
    };

    let failure!: PropertyTestFailure;
    try {
      await propertyTest(machine, {
        adapter: fastCheckAdapter({ seed: 10, numRuns: 20, maxCommands: 4 }),
        events: { ADD: fc.record({ value: fc.integer({ min: 1, max: 5 }) }) },
        sut,
        invariant: () => {}
      });
    } catch (error) {
      failure = error as PropertyTestFailure;
    }
    expect(failure).toBeInstanceOf(PropertyTestFailure);

    const replayFailure = await replayPropertyTest(machine, failure.fixture!, {
      invariant: () => {},
      sut
    }).catch((error) => error);
    expect(replayFailure).toBeInstanceOf(PropertyTestFailure);
    expect(replayFailure.cause).toMatchObject({ sutMatches: false });
  });
});

describe('defaultEquivalent (STA-6407)', () => {
  it('compares structurally, ignoring key order', () => {
    expect(defaultEquivalent({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(defaultEquivalent({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(defaultEquivalent([1, [2, 3]], [1, [2, 3]])).toBe(true);
    expect(defaultEquivalent([1, 2], [2, 1])).toBe(false);
  });

  it('is cycle-safe', () => {
    const left: any = { name: 'node' };
    left.self = left;
    const right: any = { name: 'node' };
    right.self = right;
    expect(defaultEquivalent(left, right)).toBe(true);

    const other: any = { name: 'other' };
    other.self = other;
    expect(defaultEquivalent(left, other)).toBe(false);
  });

  it('handles values `JSON.stringify` cannot distinguish', () => {
    // `JSON.stringify` turns all of these into `null` or drops them
    expect(defaultEquivalent(NaN, NaN)).toBe(true);
    expect(defaultEquivalent(undefined, null)).toBe(false);
    expect(defaultEquivalent(new Date(0), new Date(0))).toBe(true);
    expect(defaultEquivalent(new Date(0), new Date(1))).toBe(false);
    expect(defaultEquivalent(new Set([1, 2]), new Set([2, 1]))).toBe(true);
    expect(defaultEquivalent(new Map([['a', 1]]), new Map([['a', 1]]))).toBe(
      true
    );
    expect(defaultEquivalent(new Map([['a', 1]]), new Map([['a', 2]]))).toBe(
      false
    );
  });
});

describe('extractReplayPath (STA-6407)', () => {
  it('prefers the `metadataForReplay()` accessor', () => {
    const counterexample = {
      metadataForReplay: () => 'replayPath="AAAAA:H"',
      toString: () => 'cmd1,cmd2 /*replayPath="WRONG"*/'
    };
    expect(extractReplayPath(counterexample)).toBe('AAAAA:H');
  });

  it('falls back to parsing `toString()`', () => {
    const counterexample = {
      toString: () => 'INC(),INC() /*replayPath="BBBB:C"*/'
    };
    expect(extractReplayPath(counterexample)).toBe('BBBB:C');
  });

  it('returns undefined when no replay path is present', () => {
    expect(extractReplayPath(undefined)).toBeUndefined();
    expect(extractReplayPath(null)).toBeUndefined();
    expect(
      extractReplayPath({ toString: () => 'INC(),INC()' })
    ).toBeUndefined();
    expect(
      extractReplayPath({ metadataForReplay: () => '', toString: () => '' })
    ).toBeUndefined();
  });

  it('matches the shape fast-check actually produces', () => {
    // pinned against the real `fc.commands` counterexample shape
    const arbitrary = fc.commands<{ ran: boolean }, undefined>([
      fc.constant({
        check: () => true,
        run: (model: { ran: boolean }) => {
          model.ran = true;
        },
        toString: () => 'RUN()'
      })
    ]);
    const result = fc.check(
      fc.property(arbitrary, (generated) => {
        const model = { ran: false };
        fc.modelRun(() => ({ model, real: undefined }), generated);
        return !model.ran;
      }),
      { seed: 12, numRuns: 50 }
    );

    expect(result.failed).toBe(true);
    const replayPath = extractReplayPath(result.counterexample?.[0]);
    expect(replayPath).toBeTypeOf('string');
    expect(replayPath).not.toBe('');
    // the extracted path round-trips into `fc.commands`
    expect(() =>
      fc.commands([fc.constant({ check: () => true, run: () => {} })], {
        replayPath
      })
    ).not.toThrow();
  });
});
