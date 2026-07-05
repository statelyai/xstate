import { createActor, setup, types } from '../src/index.ts';

describe('setup', () => {
  it('exposes schemas', () => {
    const schemas = {
      context: types<{ count: number }>(),
      events: {
        INC: types<{ value: number }>()
      },
      actions: {
        track: {
          params: types<{ key: string }>()
        }
      },
      guards: {
        hasAccess: {
          params: types<{ role: string }>()
        }
      },
      emitted: {
        changed: types<{ value: number }>()
      },
      input: types<{ start: number }>(),
      output: types<{ total: number }>(),
      meta: types<{ label: string }>(),
      tags: types<'active'>(),
      children: {
        child: types<unknown>()
      }
    };

    const s = setup({ schemas });

    expect(s.schemas).toBe(schemas);
    expect(setup().schemas).toEqual({});
  });

  it('extends implementations', () => {
    const calls: string[] = [];

    const machine = setup({
      actions: {
        base: () => {
          calls.push('base');
        }
      },
      guards: {
        canRun: () => true
      },
      delays: {
        short: 1
      }
    })
      .extend({
        actions: {
          extended: () => {
            calls.push('extended');
          }
        },
        guards: {
          canFinish: () => true
        }
      })
      .createMachine({
        initial: 'idle',
        on: {
          RUN: ({ guards }) => {
            if (guards.canRun() && guards.canFinish()) {
              return { target: '.done' };
            }
          }
        },
        states: {
          idle: {
            entry: ({ actions }, enq) => {
              enq(actions.base);
              enq(actions.extended);
            }
          },
          done: {}
        }
      });

    const actor = createActor(machine).start();
    actor.send({ type: 'RUN' });

    expect(calls).toEqual(['base', 'extended']);
    expect(actor.getSnapshot().value).toBe('done');
    expect(machine.implementations.delays.short).toBe(1);
  });
});
