import { constant } from 'fast-check';
import { createMachine, types } from 'xstate';
import { testPaths } from '../../src/index.ts';

const model = createMachine({
  schemas: { events: { PING: types<{}>() } },
  on: { PING: () => ({}) }
});

it('covers named cases and consecutive no-op steps in a single walk', async () => {
  const sent: string[] = [];
  const { results, coverage } = await testPaths(model, {
    samples: 1,
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
