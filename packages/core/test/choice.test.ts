import z from 'zod';
import { createActor, createMachine, fromPromise } from '../src';
import { createInertActorScope } from '../src/getNextSnapshot';

describe('choice states', () => {
  it('routes through the first matching declarative choice', () => {
    const machine = createMachine({
      context: {
        isVip: true,
        overBudget: true
      },
      initial: 'routing',
      states: {
        routing: {
          type: 'choice',
          choices: [
            {
              guard: ({ context }) => context.isVip,
              target: 'vipFlow'
            },
            {
              guard: ({ context }) => context.overBudget,
              target: 'review'
            },
            { target: 'standardFlow' }
          ]
        },
        vipFlow: {},
        review: {},
        standardFlow: {}
      }
    });

    const actor = createActor(machine).start();

    expect(actor.getSnapshot().value).toBe('vipFlow');
  });

  it('routes through the default declarative choice when guards do not match', () => {
    const machine = createMachine({
      context: {
        isVip: false,
        overBudget: false
      },
      initial: 'routing',
      states: {
        routing: {
          type: 'choice',
          choices: [
            {
              guard: { type: 'isVip' },
              target: 'vipFlow'
            },
            {
              guard: { type: 'isOverBudget' },
              target: 'review'
            },
            { target: 'standardFlow' }
          ]
        },
        vipFlow: {},
        review: {},
        standardFlow: {}
      },
      guards: {
        isVip: ({ context }) => context.isVip,
        isOverBudget: ({ context }) => context.overBudget
      }
    });

    const actor = createActor(machine).start();

    expect(actor.getSnapshot().value).toBe('standardFlow');
  });

  it('routes through a function choice', () => {
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
            ROUTE: 'routing'
          }
        },
        routing: {
          type: 'choice',
          choices: ({ context }) => {
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

  it('throws when a declarative choice state has no default choice', () => {
    expect(() =>
      createMachine({
        initial: 'routing',
        states: {
          routing: {
            type: 'choice',
            choices: [{ guard: () => false, target: 'a' }]
          },
          a: {}
        }
      })
    ).toThrow(
      'Choice state "(machine).routing" must declare a default choice without a guard.'
    );
  });

  it('throws when a declarative choice uses a string guard', () => {
    expect(() =>
      createMachine({
        initial: 'routing',
        states: {
          routing: {
            type: 'choice',
            choices: [{ guard: 'isReady', target: 'a' }, { target: 'a' }]
          },
          a: {}
        }
      } as any)
    ).toThrow(
      'Choice state "(machine).routing" cannot declare a string guard. Use a guard object or inline guard function.'
    );
  });

  it('throws when a function choice does not resolve to a target', () => {
    const machine = createMachine({
      initial: 'routing',
      states: {
        routing: {
          type: 'choice',
          choices: (() => undefined) as any
        },
        done: {}
      }
    });

    expect(() =>
      machine.getInitialSnapshot(createInertActorScope(machine))
    ).toThrow('Choice state "(machine).routing" must resolve to a target.');
  });

  it.each([
    ['invoke', { invoke: { src: fromPromise(async () => undefined) } }],
    ['after', { after: { 10: 'done' } }],
    ['on', { on: { NEXT: 'done' } }],
    ['entry', { entry: () => undefined }],
    ['exit', { exit: () => undefined }]
  ])('throws when a choice state declares `%s`', (key, config) => {
    expect(() =>
      createMachine({
        initial: 'routing',
        states: {
          routing: {
            type: 'choice',
            choices: [{ target: 'done' }],
            ...(config as any)
          },
          done: {}
        }
      })
    ).toThrow(`Choice state "(machine).routing" cannot declare \`${key}\`.`);
  });
});
