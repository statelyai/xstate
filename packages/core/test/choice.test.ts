import z from 'zod';
import { createActor, createMachine, createAsyncLogic } from '../src';
import { createInertActorScope } from '../src/getNextSnapshot';

describe('choice states', () => {
  it('routes through the first matching condition', () => {
    const machine = createMachine({
      context: {
        isVip: true,
        overBudget: true
      },
      initial: 'routing',
      states: {
        routing: {
          type: 'choice',
          choice: ({ context }) => {
            if (context.isVip) {
              return { target: 'vipFlow' };
            }
            if (context.overBudget) {
              return { target: 'review' };
            }
            return { target: 'standardFlow' };
          }
        },
        vipFlow: {},
        review: {},
        standardFlow: {}
      }
    });

    const actor = createActor(machine).start();

    expect(actor.getSnapshot().value).toBe('vipFlow');
  });

  it('routes through the fallback when no condition matches', () => {
    const machine = createMachine({
      context: {
        isVip: false,
        overBudget: false
      },
      initial: 'routing',
      states: {
        routing: {
          type: 'choice',
          choice: ({ context, guards }) => {
            if (guards.isVip(context)) {
              return { target: 'vipFlow' };
            }
            if (guards.isOverBudget(context)) {
              return { target: 'review' };
            }
            return { target: 'standardFlow' };
          }
        },
        vipFlow: {},
        review: {},
        standardFlow: {}
      },
      guards: {
        isVip: ({ isVip }: { isVip: boolean }) => isVip,
        isOverBudget: ({ overBudget }: { overBudget: boolean }) => overBudget
      }
    });

    const actor = createActor(machine).start();

    expect(actor.getSnapshot().value).toBe('standardFlow');
  });

  it('routes when entered via a transition', () => {
    const machine = createMachine({
      schemas: {
        context: z.object({
          isVip: z.boolean(),
          overBudget: z.boolean()
        }),
        events: {
          ROUTE: z.object({})
        }
      },
      context: {
        isVip: false,
        overBudget: true
      },
      initial: 'idle',
      states: {
        idle: {
          on: {
            ROUTE: { target: 'routing' }
          }
        },
        routing: {
          type: 'choice',
          choice: ({ context }) => {
            if (context.isVip) {
              return { target: 'vipFlow' };
            }
            if (context.overBudget) {
              return { target: 'review' };
            }
            return { target: 'standardFlow' };
          }
        },
        vipFlow: {},
        review: {},
        standardFlow: {}
      }
    });

    const actor = createActor(machine).start();

    actor.trigger.ROUTE();

    expect(actor.getSnapshot().value).toBe('review');
  });

  it('throws when a choice state does not declare a `choice` function', () => {
    expect(() =>
      createMachine({
        initial: 'routing',
        states: {
          routing: {
            type: 'choice'
          },
          a: {}
        }
      } as any)
    ).toThrow(
      'Choice state "(machine).routing" must declare a `choice` function.'
    );
  });

  it('throws when a non-choice state declares `choice`', () => {
    expect(() =>
      createMachine({
        initial: 'a',
        states: {
          a: {
            choice: () => ({ target: 'b' })
          },
          b: {}
        }
      } as any)
    ).toThrow(
      'State "(machine).a" has `choice`, but `choice` can only be used with `type: \'choice\'`.'
    );
  });

  it('throws when a choice does not resolve to a target', () => {
    const machine = createMachine({
      initial: 'routing',
      states: {
        routing: {
          type: 'choice',
          choice: (() => undefined) as any
        },
        done: {}
      }
    });

    expect(() =>
      machine.getInitialSnapshot(createInertActorScope(machine))
    ).toThrow('Choice state "(machine).routing" must resolve to a target.');
  });

  it.each([
    [
      'invoke',
      { invoke: { src: createAsyncLogic({ run: async () => undefined }) } }
    ],
    ['after', { after: { 10: { target: 'done' } } }],
    ['on', { on: { NEXT: { target: 'done' } } }],
    ['entry', { entry: () => undefined }],
    ['exit', { exit: () => undefined }]
  ])('throws when a choice state declares `%s`', (key, config) => {
    expect(() =>
      createMachine({
        initial: 'routing',
        states: {
          routing: {
            type: 'choice',
            choice: () => ({ target: 'done' }),
            ...(config as any)
          },
          done: {}
        }
      })
    ).toThrow(`Choice state "(machine).routing" cannot declare \`${key}\`.`);
  });
});
