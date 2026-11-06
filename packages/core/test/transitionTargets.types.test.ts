import { createMachine, setup, types } from '../src/index.ts';

const s = setup({ schemas: { events: { GO: types<{}>() } } });

describe('transition target types', () => {
  it('accepts valid static, returned and dynamic targets', () => {
    const dynamic: string = String(Math.random());

    createMachine({
      id: 'm',
      initial: 'a',
      states: {
        a: {
          initial: 'child',
          states: { child: { id: 'deep' }, other: {} },
          on: {
            GO: () => {
              if (Math.random()) return { target: 'b' };
              if (Math.random()) return { target: '.other' };
              if (Math.random()) return { target: '#deep' };
              return { target: dynamic };
            }
          }
        },
        b: { on: { GO: { target: 'a.other' } } }
      }
    });

    s.createMachine({
      initial: 'a',
      states: {
        a: { on: { GO: () => ({ target: 'b' }) } },
        b: { on: { GO: { target: 'a' } } }
      }
    });

    expect(true).toBe(true);
  });

  it('rejects unknown targets in createMachine', () => {
    if (false) {
      // @ts-expect-error - 'bb' is not a state
      createMachine({
        initial: 'a',
        states: { a: { on: { GO: { target: 'bb' } } }, b: {} }
      });

      // @ts-expect-error - 'bb' is not a state
      createMachine({
        initial: 'a',
        states: { a: { on: { GO: () => ({ target: 'bb' }) } }, b: {} }
      });
    }

    expect(true).toBe(true);
  });

  it('rejects unknown targets in setup().createMachine', () => {
    if (false) {
      // @ts-expect-error - 'bb' is not a state
      setup({}).createMachine({
        initial: 'a',
        states: { a: { on: { GO: { target: 'bb' } } }, b: {} }
      });

      // @ts-expect-error - 'bb' is not a state
      s.createMachine({
        initial: 'a',
        states: { a: { on: { GO: { target: 'bb' } } }, b: {} }
      });

      // @ts-expect-error - 'bb' is not a state
      s.createMachine({
        initial: 'a',
        states: { a: { on: { GO: () => ({ target: 'bb' }) } }, b: {} }
      });
    }

    expect(true).toBe(true);
  });
});
