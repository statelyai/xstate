import { createMachine, setup } from '../src/index.ts';

describe('delay names in `after`', () => {
  it('rejects undeclared delay names when delays are declared', () => {
    if (false) {
      setup({ delays: { short: 100 } }).createMachine({
        initial: 'a',
        states: {
          a: {
            after: {
              // @ts-expect-error - `unknownDelay` is not a declared delay
              unknownDelay: { target: 'b' }
            }
          },
          b: {}
        }
      });

      createMachine({
        delays: { short: 100 },
        initial: 'a',
        states: {
          a: {
            after: {
              // @ts-expect-error - `unknownDelay` is not a declared delay
              unknownDelay: { target: 'b' }
            }
          },
          b: {}
        }
      });
    }

    expect(true).toBe(true);
  });

  it('accepts declared names, numbers and duration strings', () => {
    setup({ delays: { short: 100 } }).createMachine({
      initial: 'a',
      states: {
        a: {
          after: {
            short: { target: 'b' },
            1000: { target: 'b' },
            '250ms': { target: 'b' },
            '1.5s': { target: 'b' },
            PT1M30S: { target: 'b' }
          }
        },
        b: {}
      }
    });

    createMachine({
      delays: { short: 100 },
      initial: 'a',
      states: {
        a: { after: { short: { target: 'b' }, '5s': { target: 'b' } } },
        b: {}
      }
    });

    setup({ delays: { short: 100 } })
      .extend({ delays: { long: 500 } })
      .createMachine({
        initial: 'a',
        states: {
          a: { after: { short: { target: 'b' }, long: { target: 'b' } } },
          b: {}
        }
      });

    expect(true).toBe(true);
  });

  it('stays permissive without declared delays', () => {
    setup({}).createMachine({
      initial: 'a',
      states: { a: { after: { anything: { target: 'b' } } }, b: {} }
    });
    createMachine({
      initial: 'a',
      states: { a: { after: { anything: { target: 'b' } } }, b: {} }
    });

    expect(true).toBe(true);
  });
});
