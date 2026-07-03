import { createActor, createMachine, setup, types, isTypeSchema } from '../src';

describe('type-only schemas (`types`)', () => {
  it('infers context and events without a runtime schema library', () => {
    const machine = createMachine({
      schemas: {
        context: types<{ count: number }>(),
        events: {
          inc: types<{ by: number }>(),
          reset: types<{}>()
        }
      },
      context: { count: 0 },
      initial: 'active',
      states: {
        active: {
          on: {
            inc: ({ context, event }) => ({
              context: { count: context.count + event.by }
            }),
            reset: () => ({ context: { count: 0 } })
          }
        }
      }
    });

    const actor = createActor(machine).start();
    actor.trigger.inc({ by: 5 });
    expect(actor.getSnapshot().context.count).toBe(5);
    actor.trigger.reset();
    expect(actor.getSnapshot().context.count).toBe(0);
  });

  it('does not validate at runtime (identity passthrough)', () => {
    const schema = types<{ a: number }>();
    expect(isTypeSchema(schema)).toBe(true);
    // a real Standard Schema that accepts anything
    const result = schema['~standard'].validate({ anything: true } as any);
    expect(result).toEqual({ value: { anything: true } });
  });

  it('interops with input/output type-only schemas', () => {
    const machine = createMachine({
      schemas: {
        context: types<{ total: number }>(),
        input: types<{ start: number }>(),
        output: types<{ total: number }>()
      },
      context: ({ input }) => ({ total: input.start }),
      initial: 'done',
      states: {
        done: { type: 'final' }
      },
      output: ({ context }) => ({ total: context.total })
    });

    const actor = createActor(machine, { input: { start: 7 } }).start();
    expect(actor.getSnapshot().output).toEqual({ total: 7 });
  });

  it('checks top-level final outputs against the machine output schema', () => {
    createMachine({
      schemas: {
        output: types<{ status: 'ok' }>()
      },
      initial: 'done',
      states: {
        done: {
          type: 'final',
          output: { status: 'ok' }
        }
      },
      output: ({ output }) => {
        const status: 'ok' = output.status;
        return { status };
      }
    });

    createMachine({
      schemas: {
        output: types<{ status: 'ok' }>()
      },
      initial: 'done',
      states: {
        done: {
          type: 'final',
          output: { status: 'ok' }
        },
        failed: {
          type: 'final',
          // @ts-expect-error
          output: { status: 'error' }
        }
      },
      output: ({ output }) => output
    });

    createMachine({
      schemas: {
        output: types<{ status: 'ok' }>()
      },
      initial: 'active',
      states: {
        active: {
          initial: 'done',
          states: {
            done: {
              type: 'final',
              output: { nested: true }
            }
          }
        },
        done: {
          type: 'final',
          output: { status: 'ok' }
        }
      },
      output: { status: 'ok' }
    });
  });

  it('checks top-level final outputs without a root output mapper', () => {
    createMachine({
      schemas: {
        output: types<{ status: 'ok' }>()
      },
      initial: 'done',
      states: {
        done: {
          type: 'final',
          output: { status: 'ok' }
        }
      }
    });

    createMachine({
      schemas: {
        output: types<{ status: 'ok' }>()
      },
      initial: 'done',
      states: {
        done: {
          type: 'final',
          // @ts-expect-error
          output: { status: 'error' }
        }
      }
    });
  });

  it('keeps top-level final outputs constrained to machine output with a root mapper', () => {
    createMachine({
      schemas: {
        output: types<{ status: 'ok' }>()
      },
      initial: 'done',
      states: {
        done: {
          type: 'final',
          output: { status: 'ok' }
        }
      },
      output: ({ output }) => output
    });

    createMachine({
      schemas: {
        output: types<{ status: 'ok' }>()
      },
      initial: 'done',
      states: {
        done: {
          type: 'final',
          // @ts-expect-error
          output: { status: 'error' }
        }
      },
      output: ({ output }) => output
    });
  });

  it('checks setup top-level final outputs against the machine output schema', () => {
    const s = setup({
      schemas: {
        output: types<{ status: 'ok' }>()
      }
    });

    s.createMachine({
      initial: 'done',
      states: {
        done: {
          type: 'final',
          output: { status: 'ok' }
        }
      }
    });

    s.createMachine({
      initial: 'done',
      states: {
        done: {
          type: 'final',
          // @ts-expect-error
          output: { status: 'error' }
        }
      },
      output: ({ output }) => output
    });
  });
});
