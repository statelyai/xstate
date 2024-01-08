import {
  createActor,
  createMachine,
  fromTransition,
  getNextSnapshot
} from '../src';
import { getInitialSnapshot } from '../src/getNextSnapshot';

describe('getNextSnapshot', () => {
  it('should calculate the next snapshot for transition logic', () => {
    const logic = fromTransition(
      (state, event) => {
        if (event.type === 'next') {
          return { count: state.count + 1 };
        } else {
          return state;
        }
      },
      { count: 0 }
    );

    const init = getInitialSnapshot(logic, undefined);
    const s1 = getNextSnapshot(logic, init, { type: 'next' });
    expect(s1.context.count).toEqual(1);
    const s2 = getNextSnapshot(logic, s1, { type: 'next' });
    expect(s2.context.count).toEqual(2);
  });
  it('should calculate the next snapshot for machine logic', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: 'b'
          }
        },
        b: {
          on: {
            NEXT: 'c'
          }
        },
        c: {}
      }
    });

    const init = getInitialSnapshot(machine, undefined);
    const s1 = getNextSnapshot(machine, init, { type: 'NEXT' });

    expect(s1.value).toEqual('b');

    const s2 = getNextSnapshot(machine, s1, { type: 'NEXT' });

    expect(s2.value).toEqual('c');
  });
  it('should not execute actions', () => {
    const fn = jest.fn();

    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            event: {
              target: 'b',
              actions: fn
            }
          }
        },
        b: {}
      }
    });

    const init = getInitialSnapshot(machine, undefined);
    const nextSnapshot = getNextSnapshot(machine, init, { type: 'event' });

    expect(fn).not.toHaveBeenCalled();
    expect(nextSnapshot.value).toEqual('b');
  });
});
