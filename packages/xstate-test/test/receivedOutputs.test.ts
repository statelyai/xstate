import { constant } from 'fast-check';
import { createMachine, types } from 'xstate';
import { z } from 'zod';
import {
  ModelTestFailureError,
  propertyTest,
  replayTest,
  ReplayNotReproducedError,
  type TestFixture
} from '../src/index.ts';

const coin = createMachine({
  schemas: {
    events: {
      FLIP: types<{}>(),
      HEADS: z.object({}),
      TAILS: types<{}>(),
      CLAIM_PRIZE: types<{}>(),
      BANANA: types<{}>()
    }
  },
  initial: 'ready',
  states: {
    ready: { on: { FLIP: { target: 'flipping' } } },
    flipping: {
      on: {
        HEADS: { target: 'heads' },
        TAILS: { target: 'tails' }
      }
    },
    heads: { on: { CLAIM_PRIZE: { target: 'claimed' } } },
    claimed: { type: 'final' },
    tails: { type: 'final' }
  }
});

function coinSut(output: 'HEADS' | 'TAILS' | 'BANANA', sent: string[]) {
  return {
    create() {
      let publish: ((event: { type: typeof output }) => void) | undefined;
      return {
        send(event: { type: string }) {
          sent.push(event.type);
          if (event.type === 'FLIP') publish?.({ type: output });
        },
        receive({ signal }: { signal: AbortSignal }) {
          return new Promise<{ type: typeof output }>((resolve, reject) => {
            publish = resolve;
            signal.addEventListener('abort', () => reject(signal.reason), {
              once: true
            });
          });
        }
      };
    }
  };
}

it('follows a received output and replays only the recorded branch', async () => {
  const failOnClaim = ({ snapshot }: { snapshot: { status: string } }) => {
    if (snapshot.status === 'done')
      throw new Error('Prize could not be claimed');
  };
  const sent: string[] = [];
  let fixture: TestFixture | undefined;
  await expect(
    propertyTest(coin, {
      seed: 3,
      numRuns: 30,
      maxCommands: 6,
      endOnFailure: true,
      events: {
        FLIP: {
          generate: constant({}),
          when: ({ snapshot }) => snapshot.matches('ready')
        },
        CLAIM_PRIZE: {
          generate: constant({}),
          when: ({ snapshot }) => snapshot.matches('heads')
        }
      },
      sut: coinSut('HEADS', sent),
      invariant: failOnClaim
    }).catch((error: unknown) => {
      if (error instanceof ModelTestFailureError) {
        fixture = error.fixture;
      }
      throw error;
    })
  ).rejects.toThrow('Prize could not be claimed');
  expect(sent).toContain('CLAIM_PRIZE');
  expect(sent).not.toContain('HEADS');
  expect(fixture?.timeline.map(({ command }) => command)).toMatchObject([
    { type: 'event', event: { type: 'FLIP' } },
    { type: 'event', event: { type: 'HEADS' }, origin: 'receive' },
    { type: 'event', event: { type: 'CLAIM_PRIZE' } }
  ]);

  const recorded = JSON.parse(JSON.stringify(fixture)) as TestFixture;
  const matching: string[] = [];
  await expect(
    replayTest(coin, recorded, {
      sut: coinSut('HEADS', matching),
      invariant: failOnClaim
    })
  ).rejects.toThrow('Prize could not be claimed');
  expect(matching).toEqual(['FLIP', 'CLAIM_PRIZE']);

  const different: string[] = [];
  await expect(
    replayTest(coin, recorded, { sut: coinSut('TAILS', different) })
  ).rejects.toBeInstanceOf(ReplayNotReproducedError);
  expect(different).toEqual(['FLIP']);

  const illegal: string[] = [];
  await expect(
    replayTest(coin, recorded, { sut: coinSut('BANANA', illegal) })
  ).rejects.toMatchObject({
    name: 'ModelTestFailureError',
    message: expect.stringContaining('BANANA')
  });
  expect(illegal).toEqual(['FLIP']);
});

const job = createMachine({
  schemas: {
    events: {
      START: types<{}>(),
      CANCEL: types<{}>(),
      COMPLETED: types<{}>()
    }
  },
  initial: 'ready',
  states: {
    ready: { on: { START: { target: 'running' } } },
    running: {
      on: {
        CANCEL: { target: 'cancelling' },
        COMPLETED: { target: 'settled' }
      }
    },
    cancelling: { on: { COMPLETED: { target: 'settled' } } },
    settled: { type: 'final' }
  }
});

function jobSut(
  completeOn: 'START' | 'CANCEL',
  sent: string[],
  completeOnSettle = false
) {
  return {
    projectModel: ({ value }: { value: unknown }) => value,
    create() {
      let value = 'ready';
      let publish: ((event: { type: 'COMPLETED' }) => void) | undefined;
      let completionPending = false;
      const complete = () => {
        completionPending = false;
        value = 'settled';
        publish?.({ type: 'COMPLETED' });
      };
      return {
        send(event: { type: string }) {
          sent.push(event.type);
          value = event.type === 'START' ? 'running' : 'cancelling';
          if (event.type === completeOn) {
            if (completeOnSettle) completionPending = true;
            else complete();
          }
        },
        settle: () => {
          if (completionPending) complete();
        },
        read: () => value,
        receive({ signal }: { signal: AbortSignal }) {
          return new Promise<{ type: 'COMPLETED' }>((resolve, reject) => {
            publish = resolve;
            signal.addEventListener('abort', () => reject(signal.reason), {
              once: true
            });
          });
        }
      };
    }
  };
}

it.each(['START', 'CANCEL'] as const)(
  'lets a mixed state follow the event that happens first when completion follows %s',
  async (completeOn) => {
    const sequences: string[][] = [];
    const sent: string[] = [];
    const { coverage } = await propertyTest(job, {
      seed: 3,
      numRuns: 30,
      maxCommands: 6,
      events: {
        START: {
          generate: constant({}),
          when: ({ snapshot }) => snapshot.matches('ready')
        },
        CANCEL: {
          generate: constant({}),
          when: ({ snapshot }) => snapshot.matches('running')
        }
      },
      sut: jobSut(completeOn, sent, true),
      collect: (trace) =>
        sequences.push(trace.steps.map(({ event }) => event.type))
    });

    expect(coverage.transitions.covered).toContain(
      JSON.stringify([
        'transition',
        completeOn === 'START' ? 'running' : 'cancelling',
        'COMPLETED',
        0
      ])
    );
    expect(coverage.sutComparisons).toBeGreaterThan(0);
    expect(sequences).toContainEqual(
      completeOn === 'START'
        ? ['START', 'COMPLETED']
        : ['START', 'CANCEL', 'COMPLETED']
    );
    if (completeOn === 'START') expect(sent).not.toContain('CANCEL');
  }
);

it('stops replay before sending an input overtaken by a legal output', async () => {
  const fixture: TestFixture = {
    formatVersion: 2,
    start: { type: 'input', input: undefined },
    receiveInputTypes: ['START', 'CANCEL'],
    timeline: [
      {
        kind: 'event',
        command: {
          type: 'event',
          event: { type: 'START' },
          phase: 'generated',
          origin: 'generator'
        }
      },
      {
        kind: 'event',
        command: {
          type: 'event',
          event: { type: 'CANCEL' },
          phase: 'generated',
          origin: 'generator'
        }
      },
      {
        kind: 'event',
        command: {
          type: 'event',
          event: { type: 'COMPLETED' },
          phase: 'generated',
          origin: 'receive'
        }
      }
    ]
  };
  const sent: string[] = [];
  await expect(
    replayTest(job, fixture, {
      expect: 'pass',
      sut: jobSut('START', sent)
    })
  ).rejects.toMatchObject({
    name: 'ReplayNotReproducedError',
    output: {
      expected: { type: 'CANCEL' },
      observed: { type: 'COMPLETED' }
    }
  });
  expect(sent).toEqual(['START']);
});

it('aborts a timed-out receive and records a retryable receive step', async () => {
  const fixture: TestFixture = {
    formatVersion: 2,
    start: { type: 'input', input: undefined },
    receiveInputTypes: ['FLIP'],
    timeline: [
      {
        kind: 'event',
        command: {
          type: 'event',
          event: { type: 'FLIP' },
          phase: 'generated',
          origin: 'generator'
        }
      },
      {
        kind: 'event',
        command: {
          type: 'event',
          event: { type: 'HEADS' },
          phase: 'generated',
          origin: 'receive'
        }
      }
    ]
  };
  let receiveSignal: AbortSignal | undefined;
  await expect(
    replayTest(coin, fixture, {
      sut: {
        create: () => ({
          send: () => {},
          receive: ({ signal }) => {
            receiveSignal = signal;
            return new Promise(() => {});
          }
        })
      }
    })
  ).rejects.toMatchObject({
    name: 'ModelTestFailureError',
    cause: expect.objectContaining({
      message: expect.stringMatching(/Timed out.*SUT output/)
    }),
    fixture: expect.objectContaining({
      timeline: [
        fixture.timeline[0],
        { kind: 'command', command: { type: 'receive' } }
      ]
    })
  });
  expect(receiveSignal?.aborted).toBe(true);
});
