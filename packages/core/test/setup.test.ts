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

  it('exposes extended schemas', () => {
    const context = types<{ count: number }>();
    const inc = types<{ value: number }>();
    const reset = types<{}>();
    const track = types<{ key: string }>();
    const notify = types<{ message: string }>();
    const hasAccess = types<{ role: string }>();
    const canReset = types<{ reason: string }>();
    const changed = types<{ value: number }>();
    const notified = types<{ message: string }>();
    const child = types<unknown>();
    const sibling = types<unknown>();
    const input = types<{ start: number }>();
    const output = types<{ total: number }>();
    const meta = types<{ label: string }>();
    const tags = types<'active'>();

    const s = setup({
      schemas: {
        context,
        events: {
          INC: inc
        },
        actions: {
          track: {
            params: track
          }
        },
        guards: {
          hasAccess: {
            params: hasAccess
          }
        },
        emitted: {
          changed
        },
        input,
        meta,
        children: {
          child
        }
      }
    }).extend({
      schemas: {
        events: {
          RESET: reset
        },
        actions: {
          notify: {
            params: notify
          }
        },
        guards: {
          canReset: {
            params: canReset
          }
        },
        emitted: {
          notified
        },
        output,
        tags,
        children: {
          sibling
        }
      }
    });

    expect(s.schemas.context).toBe(context);
    expect(s.schemas.events.INC).toBe(inc);
    expect(s.schemas.events.RESET).toBe(reset);
    expect(s.schemas.actions.track.params).toBe(track);
    expect(s.schemas.actions.notify.params).toBe(notify);
    expect(s.schemas.guards.hasAccess.params).toBe(hasAccess);
    expect(s.schemas.guards.canReset.params).toBe(canReset);
    expect(s.schemas.emitted.changed).toBe(changed);
    expect(s.schemas.emitted.notified).toBe(notified);
    expect(s.schemas.input).toBe(input);
    expect(s.schemas.output).toBe(output);
    expect(s.schemas.meta).toBe(meta);
    expect(s.schemas.tags).toBe(tags);
    expect(s.schemas.children.child).toBe(child);
    expect(s.schemas.children.sibling).toBe(sibling);
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
