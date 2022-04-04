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
    expect.assertions(3);
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
});
