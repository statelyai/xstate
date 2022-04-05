import { interpret } from '../src/interpreter';
import { createMachine } from '../src';
import { waitFor } from '../src/waitFor';

describe('waitFor', () => {
  it('should wait for a condition to be true and return the emitted value', async () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: { NEXT: 'b' }
        },
        b: {
          on: { NEXT: 'c' }
        },
        c: {}
      }
    });

    const service = interpret(machine).start();

    setInterval(() => service.send('NEXT'), 10);

    const state = await waitFor(service, (s) => s.matches('c'));

    expect(state.value).toEqual('c');
  });

  it('should throw an error after a timeout', async () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: { NEXT: 'b' }
        },
        b: {
          on: { NEXT: 'c' }
        },
        c: {}
      }
    });

    const service = interpret(machine).start();

    try {
      await waitFor(service, (state) => state.matches('c'), { timeout: 10 });
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
    }
  });

  it('should resolve correctly when the predicate immediately matches the current state', async () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {}
      }
    });

    const service = interpret(machine).start();

    await expect(
      waitFor(service, (state) => state.matches('a'))
    ).resolves.toHaveProperty('value', 'a');
  });

  it('should internally unsubscribe when the predicate immediately matches the current state', async () => {
    let count = 0;
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: 'b'
          }
        },
        b: {}
      }
    });

    const service = interpret(machine).start();

    await waitFor(service, (state) => {
      count++;
      return state.matches('a');
    });

    service.send({ type: 'NEXT' });

    expect(count).toBe(1);
  });
});
