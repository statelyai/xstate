import { constant } from 'fast-check';
import { createActor, createMachine, types, type Snapshot } from 'xstate';
import { restoreActor } from 'xstate/persist';
import {
  ModelTestFailureError,
  replayTest,
  testPaths
} from '../../src/index.ts';

const model = createMachine({
  schemas: { events: { PING: types<{}>() } },
  on: { PING: () => ({}) }
});

it('covers named cases and consecutive no-op steps in a single walk', async () => {
  const sent: string[] = [];
  const { results, coverage } = await testPaths(model, {
    samples: 1,
    toState: () => true,
    events: {
      PING: [
        { case: 'first', generate: constant({}) },
        { case: 'second', generate: constant({}) }
      ]
    },
    cover: {
      requirements: {
        sequence: [
          ({ case: name }) => name === 'first',
          ({ case: name }) => name === 'first',
          ({ case: name }) => name === 'second'
        ]
      }
    },
    sut: {
      create: () => ({
        send: (_, context) => {
          sent.push(context.case?.name ?? '');
        }
      })
    }
  });
  expect(results).toHaveLength(1);
  expect(coverage.exploration.pathGenerator).toBe('cover');
  expect(sent).toEqual(['first', 'first', 'second']);
});

it('can cover the final transition and stops offering events afterward', async () => {
  const flow = createMachine({
    initial: 'working',
    states: {
      working: { on: { FINISH: { target: 'done' } } },
      done: { type: 'final' }
    },
    schemas: { events: { FINISH: types<{}>(), PING: types<{}>() } }
  });
  const finished = ({ snapshot }: { snapshot: { status: string } }) =>
    snapshot.status === 'done';
  const { results } = await testPaths(flow, {
    cover: { requirements: { finished } }
  });
  expect(results[0].path.state.status).toBe('done');

  const create = vi.fn(() => ({ send: () => {} }));
  await expect(
    testPaths(flow, {
      events: { PING: constant({}) },
      cover: {
        requirements: {
          pingAfterFinish: [finished, ({ event }) => event.type === 'PING']
        }
      },
      sut: { create }
    })
  ).rejects.toThrow(/exhausted.*pingAfterFinish/);
  expect(create).not.toHaveBeenCalled();
});

it('keeps the snapshot window when different paths join', async () => {
  const fork = createMachine({
    initial: 'start',
    states: {
      start: { on: { LEFT: { target: 'left' }, RIGHT: { target: 'right' } } },
      left: { on: { JOIN: { target: 'joined' } } },
      right: { on: { JOIN: { target: 'joined' } } },
      joined: { on: { FINISH: { target: 'done' } } },
      done: {}
    }
  });
  const sent: string[] = [];
  await testPaths(fork, {
    cover: {
      snapshotWindow: 3,
      requirements: {
        finishViaRight: ({ event, snapshot, snapshots }) =>
          event.type === 'FINISH' &&
          snapshots.at(-1) === snapshot &&
          snapshots.at(-2)?.matches('joined') === true &&
          snapshots.at(-3)?.matches('right') === true
      }
    },
    sut: {
      create: () => ({
        send: (event) => {
          sent.push(event.type);
        }
      })
    }
  });
  expect(sent).toEqual(['RIGHT', 'JOIN', 'FINISH']);
});

it('names the requirements missing within the depth budget before creating the SUT', async () => {
  const create = vi.fn(() => ({ send: () => {} }));
  const ping = ({ event }: { event: { type: string } }) =>
    event.type === 'PING';
  await expect(
    testPaths(model, {
      cover: {
        maxStepsPerPath: 2,
        requirements: { triplePing: [ping, ping, ping] }
      },
      sut: { create }
    })
  ).rejects.toThrow(/maxStepsPerPath \(2\).*triplePing/);
  expect(create).not.toHaveBeenCalled();
});

it('executes from the same starting snapshot that the planner used', async () => {
  const flow = createMachine({
    initial: 'idle',
    states: {
      idle: {},
      working: { on: { FINISH: { target: 'done' } } },
      done: {}
    }
  });
  const { results } = await testPaths(flow, {
    fromState: flow.resolveState({ value: 'working' }),
    cover: {
      requirements: {
        finish: ({ snapshot, snapshots }) =>
          snapshots.at(-2)?.matches('working') === true &&
          snapshot.matches('done')
      }
    }
  });
  expect(results).toHaveLength(1);
  expect(results[0].path.state.matches('done')).toBe(true);
});

const request = createMachine({
  initial: 'pending',
  states: {
    pending: {
      on: {
        APPROVE: { target: 'approved' },
        CANCEL: { target: 'cancelled' },
        REVIEW: { target: 'reviewing' }
      }
    },
    reviewing: { on: { APPROVE: { target: 'approved' } } },
    approved: { type: 'final' },
    cancelled: { type: 'final' }
  }
});

it('covers mutually exclusive goals with the shortest two independent walks by default', async () => {
  const sessions: string[][] = [];
  const create = vi.fn(() => {
    const sent: string[] = [];
    sessions.push(sent);
    return {
      send: (event: { type: string }) => {
        sent.push(event.type);
      }
    };
  });
  const options = {
    toState: (snapshot: { status: string }) => snapshot.status === 'done',
    cover: {
      requirements: {
        approved: ({ event }: { event: { type: string } }) =>
          event.type === 'APPROVE',
        cancelled: ({ event }: { event: { type: string } }) =>
          event.type === 'CANCEL'
      }
    },
    sut: { create }
  };

  const { coverage, results } = await testPaths(request, options);
  expect(results).toHaveLength(2);
  expect(coverage.exploration.pathCount).toBe(2);
  expect(sessions).toEqual([['APPROVE'], ['CANCEL']]);

  create.mockClear();
  await expect(
    testPaths(request, {
      ...options,
      cover: { ...options.cover, maxPaths: 1 }
    })
  ).rejects.toThrow(/maxPaths \(1\).*cancelled/);
  expect(create).not.toHaveBeenCalled();
});

it('minimizes total events among plans with the same session count', async () => {
  const flow = createMachine({
    initial: 'start',
    states: {
      start: {
        on: {
          A: { target: 'done' },
          B: { target: 'done' },
          AC: { target: 'done' },
          START_LONG: { target: 'long' }
        }
      },
      long: { on: { BC: { target: 'done' } } },
      done: { type: 'final' }
    }
  });

  const { results } = await testPaths(flow, {
    cover: {
      maxPaths: 2,
      requirements: {
        a: ({ event }) => event.type === 'A' || event.type === 'AC',
        b: ({ event }) => event.type === 'B' || event.type === 'BC',
        c: ({ event }) => event.type === 'AC' || event.type === 'BC'
      }
    }
  });

  expect(results.map(({ path }) => path.steps.at(-1)?.event.type)).toEqual([
    'B',
    'AC'
  ]);
});

it('runs the exact snapshots used to plan repeated spawns', async () => {
  const worker = createMachine({});
  const flow = createMachine({
    actors: { worker },
    context: { ids: [] as string[] },
    on: {
      SPAWN: ({ context }, enq) => ({
        context: { ids: [...context.ids, enq.spawn('worker').id] }
      })
    }
  });

  const { results } = await testPaths(flow, {
    cover: {
      requirements: {
        twoWorkers: ({ snapshot }) => snapshot.context.ids.length === 2
      }
    }
  });

  expect(results[0].path.state.context.ids).toEqual(['worker:0', 'worker:1']);
});

it('prefers a longer single walk over two shorter walks', async () => {
  const flow = createMachine({
    initial: 'start',
    states: {
      start: {
        on: {
          LEFT: { target: 'done' },
          RIGHT: { target: 'done' },
          ROUTE: { target: 'route' }
        }
      },
      route: { on: { LEFT: { target: 'left' } } },
      left: { on: { RIGHT: { target: 'done' } } },
      done: { type: 'final' }
    }
  });
  const sent: string[] = [];
  const create = vi.fn(() => ({
    send: (event: { type: string }) => {
      sent.push(event.type);
    }
  }));

  await testPaths(flow, {
    cover: {
      maxPaths: 2,
      requirements: {
        left: ({ event }) => event.type === 'LEFT',
        right: ({ event }) => event.type === 'RIGHT'
      }
    },
    sut: { create }
  });

  expect(create).toHaveBeenCalledTimes(1);
  expect(sent).toEqual(['ROUTE', 'LEFT', 'RIGHT']);
});

it('preserves history in a fixture planned from a snapshot', async () => {
  const flow = createMachine({
    initial: 'inside',
    states: {
      inside: {
        initial: 'first',
        states: {
          first: { on: { NEXT: { target: 'second' } } },
          second: {},
          history: { type: 'history', target: 'first' }
        },
        on: { LEAVE: { target: 'outside' } }
      },
      outside: { on: { RETURN: { target: 'inside.history' } } }
    }
  });
  const actor = createActor(flow).start();
  actor.send({ type: 'NEXT' });
  actor.send({ type: 'LEAVE' });
  const fromState = actor.getSnapshot();
  actor.stop();

  const states = {
    'inside.second': () => {
      throw new Error('Remembered second state');
    }
  };
  const failure = await testPaths(flow, {
    fromState,
    cover: {
      requirements: { returned: ({ event }) => event.type === 'RETURN' }
    },
    states
  }).catch((error: unknown) => error);

  expect(failure).toBeInstanceOf(ModelTestFailureError);
  if (!(failure instanceof ModelTestFailureError) || !failure.fixture) {
    throw new Error('Expected a replay fixture');
  }
  const fixture = JSON.parse(JSON.stringify(failure.fixture));
  await expect(
    replayTest(flow, fixture, {
      restoreSnapshot: (snapshot) =>
        restoreActor(flow, snapshot as Snapshot<unknown>).getSnapshot(),
      states
    })
  ).rejects.toThrow('Remembered second state');
});

it('counts stored replays toward a hard session budget before creating the SUT', async () => {
  const create = vi.fn(() => ({ send: () => {} }));
  await expect(
    testPaths(request, {
      cover: {
        maxPaths: 1,
        requirements: { approval: ({ event }) => event.type === 'APPROVE' }
      },
      sut: { create },
      failures: {
        load: () => [
          {
            fixture: {
              formatVersion: 2,
              start: { type: 'input', input: undefined },
              timeline: []
            }
          }
        ],
        onFailure: () => {}
      }
    })
  ).rejects.toThrow(/maxPaths \(1\).*1 stored fixture.*1 planned walk/);
  expect(create).not.toHaveBeenCalled();
});
