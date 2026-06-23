import { createActor, setup } from '../src/index.ts';

describe('setup', () => {
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
