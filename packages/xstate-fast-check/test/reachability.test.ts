import * as fc from 'fast-check';
import { createAsyncLogic, createMachine } from 'xstate';
import { propertyTest } from 'xstate/graph';
import { fastCheckAdapter } from '../src/index.ts';

const adapter = () =>
  fastCheckAdapter({ seed: 42, numRuns: 25, maxCommands: 6 });

const noop = () => {};

describe('static reachability of property coverage', () => {
  const historyMachine = createMachine({
    id: 'hist',
    initial: 'outside',
    states: {
      outside: {
        on: {
          ENTER: { target: 'group' },
          RESUME: { target: 'group.recall' }
        }
      },
      group: {
        initial: 'entry',
        states: {
          entry: { on: { LEAVE: { target: '#hist.outside' } } },
          // Reachable only as the history node's default target.
          restored: {},
          recall: { type: 'history', target: 'restored' }
        }
      }
    }
  });

  it('treats history default targets as reachable when never entered', async () => {
    // `RESUME` is never generated, so the history node is never entered at
    // runtime; its default target must still be classified statically.
    const { coverage } = await propertyTest(historyMachine, {
      adapter: adapter(),
      events: { ENTER: fc.constant({}), LEAVE: fc.constant({}) },
      invariant: noop
    });

    expect(coverage.stateNodes.unreachable).not.toContain(
      'hist.group.restored'
    );
    expect(coverage.stateNodes.uncovered).toContain('hist.group.restored');
  });

  it('covers history default targets once the history node is entered', async () => {
    const { coverage } = await propertyTest(historyMachine, {
      adapter: adapter(),
      events: {
        ENTER: fc.constant({}),
        LEAVE: fc.constant({}),
        RESUME: fc.constant({})
      },
      invariant: noop
    });

    expect(coverage.stateNodes.covered).toContain('hist.group.restored');
  });

  it('treats invoke onDone/onError targets as reachable', async () => {
    const machine = createMachine({
      id: 'inv',
      initial: 'loading',
      states: {
        loading: {
          on: { PING: { target: 'loading' } },
          invoke: {
            src: createAsyncLogic({ run: async () => 1 }),
            onDone: { target: 'success' },
            onError: { target: 'failure' }
          }
        },
        success: {},
        failure: {}
      }
    });

    const { coverage } = await propertyTest(machine, {
      adapter: adapter(),
      events: { PING: fc.constant({}) },
      invariant: noop
    });

    // Invoked actors are not executed on the pure transition path, so these
    // stay uncovered — but they must never be reported as unreachable.
    expect(coverage.stateNodes.unreachable).toEqual([]);
    expect(coverage.stateNodes.uncovered).toEqual(
      expect.arrayContaining(['inv.success', 'inv.failure'])
    );
  });

  it('treats compound onDone targets as reachable', async () => {
    const machine = createMachine({
      id: 'done',
      initial: 'work',
      states: {
        work: {
          initial: 'step',
          states: {
            step: { on: { FINISH: { target: 'complete' } } },
            complete: { type: 'final' }
          },
          onDone: { target: 'wrapUp' }
        },
        wrapUp: {}
      }
    });

    const { coverage } = await propertyTest(machine, {
      adapter: adapter(),
      events: { FINISH: fc.constant({}) },
      invariant: noop
    });

    expect(coverage.stateNodes.unreachable).toEqual([]);
    expect(coverage.stateNodes.covered).toContain('done.wrapUp');
  });

  it('treats `after` delayed transition targets as reachable', async () => {
    const machine = createMachine({
      id: 'delay',
      initial: 'waiting',
      states: {
        waiting: {
          on: { PING: { target: 'waiting' } },
          after: { 1000: { target: 'timedOut' } }
        },
        timedOut: {}
      }
    });

    const { coverage } = await propertyTest(machine, {
      adapter: adapter(),
      events: { PING: fc.constant({}) },
      invariant: noop
    });

    // Delays are not fired on the pure transition path.
    expect(coverage.stateNodes.unreachable).toEqual([]);
    expect(coverage.stateNodes.uncovered).toContain('delay.timedOut');
  });

  it('treats parallel regions and `always` targets as reachable', async () => {
    const machine = createMachine({
      id: 'par',
      type: 'parallel',
      states: {
        left: {
          initial: 'idle',
          states: {
            idle: { on: { GO: { target: 'gate' } } },
            gate: { always: { target: 'settled' } },
            settled: {}
          }
        },
        right: {
          initial: 'watching',
          states: { watching: {} }
        }
      }
    });

    const { coverage } = await propertyTest(machine, {
      adapter: adapter(),
      events: { GO: fc.constant({}) },
      invariant: noop
    });

    expect(coverage.stateNodes.unreachable).toEqual([]);
    expect(coverage.stateNodes.covered).toEqual(
      expect.arrayContaining(['par.right.watching', 'par.left.settled'])
    );
  });

  it('still reports genuinely orphaned state nodes as unreachable', async () => {
    const machine = createMachine({
      id: 'orphan',
      initial: 'a',
      states: {
        a: { on: { GO: { target: 'b' } } },
        b: {},
        island: {}
      }
    });

    const { coverage } = await propertyTest(machine, {
      adapter: adapter(),
      events: { GO: fc.constant({}) },
      invariant: noop
    });

    expect(coverage.stateNodes.unreachable).toEqual(['orphan.island']);
  });
});
