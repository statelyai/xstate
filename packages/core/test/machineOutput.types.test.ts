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

  it('infers the root output as the union of top-level final-state outputs', () => {
    const machine = setup({
      schemas: {
        context: types<{ attempts: number }>()
      }
    }).createMachine({
      context: { attempts: 1 },
      initial: 'working',
      states: {
        working: {
          on: {
            RESOLVE: { target: 'succeeded' },
            REJECT: { target: 'failed' }
          }
        },
        succeeded: {
          type: 'final',
          output: ({ context }) => ({
            status: 'ok' as const,
            attempts: context.attempts
          })
        },
        failed: {
          type: 'final',
          output: { status: 'error' as const }
        }
      }
    });

    type Output = OutputFrom<typeof machine>;

    ((_output: Output) => {
      _output satisfies
        | { status: 'ok'; attempts: number }
        | { status: 'error' };
      // @ts-expect-error not part of the union
      _output satisfies { status: 'ok'; attempts: number };
    })({ status: 'error' });

    const actor = createActor(machine).start();
    actor.send({ type: 'REJECT' });
    expect(actor.getSnapshot().output).toEqual({ status: 'error' });
  });

  it('infers root output from top-level final states of a plain machine', () => {
    const machine = createMachine({
      initial: 'done',
      states: {
        done: {
          type: 'final',
          output: () => ({ ok: true as const })
        }
      }
    });

    ((_output: OutputFrom<typeof machine>) => {
      _output satisfies { ok: true };
    })({ ok: true });
  });

  it('includes undefined for a top-level final state without output', () => {
    const machine = setup({}).createMachine({
      initial: 'a',
      states: {
        a: { on: { NEXT: { target: 'b' } } },
        b: {
          type: 'final',
          output: () => ({ done: true })
        },
        c: { type: 'final' }
      }
    });

    type Output = OutputFrom<typeof machine>;

    ((_output: Output) => {
      _output satisfies { done: boolean } | undefined;
    })(undefined);
  });

  it('prefers a setup-declared per-state output schema for root output', () => {
    const machine = setup({
      states: {
        done: {
          type: 'final',
          schemas: { output: types<{ total: number }>() }
        }
      }
    }).createMachine({
      initial: 'done',
      states: {
        done: {
          output: () => ({ total: 1 })
        }
      }
    });

    ((_output: OutputFrom<typeof machine>) => {
      _output satisfies { total: number };
    })({ total: 1 });
  });

  it('prefers an inline per-state output schema for root output', () => {
    const machine = setup({}).createMachine({
      initial: 'done',
      states: {
        done: {
          type: 'final',
          schemas: { output: types<{ id: string }>() },
          output: () => ({ id: 'a' })
        }
      }
    });

    ((_output: OutputFrom<typeof machine>) => {
      _output satisfies { id: string };
      // @ts-expect-error the declared per-state schema is authoritative
      _output satisfies undefined;
    })({ id: 'a' });
  });

  it('keeps the root output mapper authoritative over final-state outputs', () => {
    const machine = setup({}).createMachine({
      initial: 'done',
      states: {
        done: {
          type: 'final',
          output: () => ({ inner: true })
        }
      },
      output: () => ({ outer: true })
    });

    ((_output: OutputFrom<typeof machine>) => {
      _output satisfies { outer: boolean };
      // @ts-expect-error the root mapper wins
      _output satisfies { inner: boolean };
    })({ outer: true });
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
