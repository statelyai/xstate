import { computed } from '../computed';
import { createMachine } from '../src';
import { assign } from '../src/actions';

describe('computed context', () => {
  it('computes values in context', () => {
    const machine = createMachine({
      context: computed({
        firstName: 'First',
        lastName: 'Last',
        fullName: (ctx) => [ctx.firstName, ctx.lastName].join(' '),
        nameLength: (ctx) => ctx.fullName.length
      }),
      on: {
        UPDATE: {
          actions: assign<any>({
            firstName: 'David'
          })
        }
      }
    });

    const { initialState } = machine;

    expect(initialState.context.fullName).toEqual('First Last');
    expect(initialState.context.nameLength).toEqual(10);

    const s = machine.transition(initialState, 'UPDATE');

    expect(s.context.firstName).toEqual('David');
    expect(s.context.fullName).toEqual('David Last');
  });

  it('detects circular computed values', () => {
    const machine = createMachine({
      context: computed({
        firstName: 'First',
        lastName: 'Last',
        fullName: (ctx) => [ctx.firstName, ctx.lastName].join(' '),
        circle1: (ctx) => ctx.circle2,
        circle2: (ctx) => ctx.circle1
      })
    });

    const { initialState } = machine;

    expect(() => initialState.context.circle1).toThrowError(/cycle/i);
  });

  it('prevents assigning to computed values', () => {
    const context = computed({
      firstName: 'First',
      lastName: 'Last',
      fullName: (ctx) => [ctx.firstName, ctx.lastName].join(' '),
      nameLength: (ctx) => ctx.fullName.length
    });
    const machine = createMachine<typeof context>({
      context,
      on: {
        EVENT: {
          actions: assign<typeof context>({
            fullName: 'something else'
          })
        }
      }
    });

    const s = machine.transition(undefined, 'EVENT');

    expect(s.context.fullName).toEqual('blah');
  });
});
