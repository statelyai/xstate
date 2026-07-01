import {
  createLogic,
  createMachine,
  transition,
  initialTransition
} from '../src';

describe('transition', () => {
  it('should calculate the next snapshot for custom logic', () => {
    const logic = createLogic({
      context: { count: 0 },
      run: ({ context, event }) => {
        if (event.type === 'next') {
          return { context: { count: context.count + 1 } };
        }
        return;
      }
    });

    const [init] = initialTransition(logic, undefined);
    const [s1] = transition(logic, init, { type: 'next' });
    expect(s1.context.count).toEqual(1);
    const [s2] = transition(logic, s1, { type: 'next' });
    expect(s2.context.count).toEqual(2);
  });
  it('should calculate the next snapshot for machine logic', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: { target: 'b' }
          }
        },
        b: {
          on: {
            NEXT: { target: 'c' }
          }
        },
        c: {}
      }
    });

    const [init] = initialTransition(machine, undefined);
    const [s1] = transition(machine, init, { type: 'NEXT' });

    expect(s1.value).toEqual('b');

    const [s2] = transition(machine, s1, { type: 'NEXT' });

    expect(s2.value).toEqual('c');
  });
  it('should not execute actions', () => {
    const fn = vi.fn();

    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            event: (_, enq) => {
              enq(fn);
              return { target: 'b' };
            }
          }
        },
        b: {}
      }
    });

    const [init] = initialTransition(machine, undefined);
    const [nextSnapshot] = transition(machine, init, { type: 'event' });

    expect(fn).not.toHaveBeenCalled();
    expect(nextSnapshot.value).toEqual('b');
  });
});
