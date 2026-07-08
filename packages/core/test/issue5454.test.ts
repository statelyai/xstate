import { describe, it, expect } from 'vitest';
import {
  createMachine,
  initialTransition,
  transition,
  createAsyncLogic
} from '../src';

/**
 * Regression tests for: Bug #5454 `initialTransition` fails when invoke has a
 * registry key.
 *
 * Root cause: `createInertActorScope` called `createActor(logic)` which eagerly
 * ran `getInitialSnapshot` and registered child actors with `registryKey` in
 * the system. Then `initialTransition` called `getInitialSnapshot` again on the
 * same system, causing "Actor with registry key '...' already exists".
 */
describe('initialTransition / transition with invoke registryKey (issue #5454)', () => {
  it('does not throw when the initial state has an invoke with registryKey', () => {
    const machine = createMachine({
      initial: 'idle',
      states: {
        idle: {
          invoke: {
            src: createAsyncLogic({ run: async () => 42 }),
            registryKey: 'myActor'
          }
        }
      }
    });

    expect(() => initialTransition(machine)).not.toThrow();
  });

  it('returns the correct initial snapshot when invoke has registryKey', () => {
    const machine = createMachine({
      initial: 'idle',
      states: {
        idle: {
          invoke: {
            src: createAsyncLogic({ run: async () => 42 }),
            registryKey: 'myActor'
          }
        }
      }
    });

    const [snapshot, actions] = initialTransition(machine);
    expect(snapshot.value).toBe('idle');
    expect(actions).toHaveLength(2); // spawn + deferred start for the invoke
  });

  it('is idempotent: repeated calls do not throw', () => {
    const machine = createMachine({
      initial: 'idle',
      states: {
        idle: {
          invoke: {
            src: createAsyncLogic({ run: async () => 42 }),
            registryKey: 'myActor'
          }
        }
      }
    });

    expect(() => {
      initialTransition(machine);
      initialTransition(machine);
      initialTransition(machine);
    }).not.toThrow();
  });

  it('transition() does not throw when the target state has an invoke with registryKey', () => {
    const countMachine = createMachine({});

    const machine = createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: { START: { target: 'running' } }
        },
        running: {
          invoke: {
            src: countMachine,
            registryKey: 'counter'
          }
        }
      }
    });

    const [initial] = initialTransition(machine);

    expect(() => transition(machine, initial, { type: 'START' })).not.toThrow();
  });

  it('works with multiple invokes each having a distinct registryKey', () => {
    const machine = createMachine({
      initial: 'idle',
      states: {
        idle: {
          invoke: [
            {
              src: createAsyncLogic({ run: async () => 1 }),
              registryKey: 'actorOne'
            },
            {
              src: createAsyncLogic({ run: async () => 2 }),
              registryKey: 'actorTwo'
            }
          ]
        }
      }
    });

    expect(() => initialTransition(machine)).not.toThrow();
    const [snapshot] = initialTransition(machine);
    expect(snapshot.value).toBe('idle');
  });
});
