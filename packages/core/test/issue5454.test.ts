import { describe, it, expect } from 'vitest';
import {
  createMachine,
  initialTransition,
  transition,
  fromPromise,
  fromTransition
} from '../src';

/**
 * Regression tests for: Bug #5454
 * `initialTransition` fails when invoke has `systemId`
 *
 * Root cause: `createInertActorScope` called `createActor(logic)` which
 * eagerly ran `getInitialSnapshot` and registered child actors with `systemId`
 * in the system. Then `initialTransition` called `getInitialSnapshot` again on
 * the same system, causing "Actor with system ID '...' already exists".
 */
describe('initialTransition / transition with invoke systemId (issue #5454)', () => {
  it('does not throw when the initial state has an invoke with systemId', () => {
    const machine = createMachine({
      initial: 'idle',
      states: {
        idle: {
          invoke: {
            src: fromPromise(async () => 42),
            systemId: 'myActor'
          }
        }
      }
    });

    expect(() => initialTransition(machine)).not.toThrow();
  });

  it('returns the correct initial snapshot when invoke has systemId', () => {
    const machine = createMachine({
      initial: 'idle',
      states: {
        idle: {
          invoke: {
            src: fromPromise(async () => 42),
            systemId: 'myActor'
          }
        }
      }
    });

    const [snapshot, actions] = initialTransition(machine);
    expect(snapshot.value).toBe('idle');
    expect(actions).toHaveLength(1); // the spawnChild action for the invoke
  });

  it('is idempotent: repeated calls do not throw', () => {
    const machine = createMachine({
      initial: 'idle',
      states: {
        idle: {
          invoke: {
            src: fromPromise(async () => 42),
            systemId: 'myActor'
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

  it('transition() does not throw when the target state has an invoke with systemId', () => {
    const countMachine = fromTransition(
      (s, e) => (e.type === 'INC' ? s + 1 : s),
      0
    );

    const machine = createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: { START: 'running' }
        },
        running: {
          invoke: {
            src: countMachine,
            systemId: 'counter'
          }
        }
      }
    });

    const [initial] = initialTransition(machine);

    expect(() => transition(machine, initial, { type: 'START' })).not.toThrow();
  });

  it('works with multiple invokes each having a distinct systemId', () => {
    const machine = createMachine({
      initial: 'idle',
      states: {
        idle: {
          invoke: [
            {
              src: fromPromise(async () => 1),
              systemId: 'actorOne'
            },
            {
              src: fromPromise(async () => 2),
              systemId: 'actorTwo'
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
