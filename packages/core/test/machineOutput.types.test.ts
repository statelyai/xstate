import { createActor, createMachine, setup, types } from '../src/index.ts';
import type { OutputFrom } from '../src/index.ts';

describe('machine output type inference', () => {
  it('infers the output type from the config output mapper', () => {
    const machine = setup({
      schemas: {
        context: types<{ shipped: string[] }>()
      }
    }).createMachine({
      context: { shipped: ['a'] },
      initial: 'done',
      states: { done: { type: 'final' } },
      output: ({ context }) => ({
        status: 'shipped' as const,
        skus: context.shipped
      })
    });

    type Output = OutputFrom<typeof machine>;

    ((_output: Output) => {
      _output satisfies { status: 'shipped'; skus: string[] };
    })({ status: 'shipped', skus: [] });

    const actor = createActor(machine).start();
    expect(actor.getSnapshot().output).toEqual({
      status: 'shipped',
      skus: ['a']
    });
  });

  it('infers the output type from a static config output value', () => {
    const machine = setup({}).createMachine({
      initial: 'done',
      states: { done: { type: 'final' } },
      output: { done: true, code: 200 }
    });

    ((_output: OutputFrom<typeof machine>) => {
      _output satisfies { done: boolean; code: number };
    })({ done: true, code: 200 });
  });

  it('infers the output type from the config output mapper of a plain machine', () => {
    const machine = createMachine({
      initial: 'done',
      states: { done: { type: 'final' } },
      output: () => ({ ok: true })
    });

    ((_output: OutputFrom<typeof machine>) => {
      _output satisfies { ok: boolean };
    })({ ok: true });
  });

  it('keeps an inline schemas.output authoritative', () => {
    const machine = setup({}).createMachine({
      schemas: { output: types<{ total: number }>() },
      initial: 'done',
      states: { done: { type: 'final' } },
      output: () => ({ total: 1 })
    });

    ((_output: OutputFrom<typeof machine>) => {
      _output satisfies { total: number };
      // @ts-expect-error the declared schema is authoritative
      _output satisfies { status: string };
    })({ total: 1 });
  });

  it('keeps a setup-level schemas.output authoritative', () => {
    const machine = setup({
      schemas: { output: types<{ ok: boolean }>() }
    }).createMachine({
      initial: 'done',
      states: { done: { type: 'final' } },
      output: () => ({ ok: true })
    });

    ((_output: OutputFrom<typeof machine>) => {
      _output satisfies { ok: boolean };
      // @ts-expect-error the declared schema is authoritative
      _output satisfies { status: string };
    })({ ok: true });
  });

  it('contextually types the output mapper arguments', () => {
    setup({
      schemas: {
        context: types<{ shipped: string[] }>(),
        events: {
          FINISH: types<{}>()
        }
      }
    }).createMachine({
      context: { shipped: [] },
      initial: 'done',
      states: { done: { type: 'final' } },
      output: ({ context, event }) => {
        context.shipped satisfies string[];
        // @ts-expect-error context is contextually typed
        context.shipped satisfies number[];
        event satisfies { type: string };
        return { skus: context.shipped };
      }
    });
  });

  it('leaves the output type at its default when no output is declared', () => {
    const machine = setup({}).createMachine({
      initial: 'idle',
      states: { idle: {} }
    });

    ((_output: OutputFrom<typeof machine>) => {
      _output satisfies {} | null | undefined;
    })({});
  });

  it('flows an inferred output into an invoking parent', () => {
    const child = setup({}).createMachine({
      initial: 'done',
      states: { done: { type: 'final' } },
      output: () => ({ status: 'shipped' as const })
    });

    setup({ actors: { child } }).createMachine({
      initial: 'waiting',
      states: {
        waiting: {
          invoke: {
            src: 'child',
            onDone: ({ event }) => {
              event.output satisfies { status: 'shipped' };
              // @ts-expect-error output is the inferred child output
              event.output satisfies { status: 'cancelled' };
              return { target: 'done' as const };
            }
          }
        },
        done: {}
      }
    });
  });

  it('does not regress state completion output typing', () => {
    setup({
      states: {
        step: {
          schemas: { output: types<{ count: number }>() }
        }
      }
    }).createMachine({
      initial: 'step',
      states: {
        step: {
          type: 'final',
          output: () => ({ count: 1 })
        }
      }
    });
  });
});
