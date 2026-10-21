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

  it('preserves optional payload fields declared via types()', () => {
    const machine = setup({
      schemas: {
        events: {
          submit: types<{ email: string; referrer?: string }>()
        }
      }
    }).createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            submit: ({ event }) => {
              event.email satisfies string;
              event.referrer satisfies string | undefined;
              // @ts-expect-error - referrer may be undefined
              event.referrer satisfies string;
              return {};
            }
          }
        }
      }
    });

    const actor = createActor(machine).start();
    // optional field must be omittable
    actor.send({ type: 'submit', email: 'a@b.co' });
    actor.send({ type: 'submit', email: 'a@b.co', referrer: 'x' });
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

  it('types final output from a setup state-local output schema', () => {
    const s = setup({
      states: {
        done: {
          schemas: {
            output: types<{ status: 'ok' }>()
          }
        }
      }
    });

    s.createMachine({
      initial: 'done',
      states: {
        done: {
          type: 'final',
          output: ({}) => ({ status: 'ok' as const })
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
      }
    });
  });

  it('types nested onDone output from a setup state-local output schema', () => {
    const s = setup({
      states: {
        workflow: {
          schemas: {
            output: types<{ receiptId: string }>()
          },
          states: {
            done: {}
          }
        }
      }
    });

    s.createMachine({
      initial: 'workflow',
      states: {
        workflow: {
          initial: 'done',
          states: {
            done: {
              type: 'final',
              output: { receiptId: 'receipt-1' }
            }
          },
          onDone: ({ event }) => {
            event.output.receiptId satisfies string;
            // @ts-expect-error - the state-local output has no `status` field
            event.output.status;
            return { target: 'complete' };
          }
        },
        complete: { type: 'final' }
      }
    });
  });

  it('types parallel aggregate output from a setup state-local output schema', () => {
    const s = setup({
      states: {
        processing: {
          schemas: {
            output: types<{
              upload: { url: string };
              validate: { valid: boolean };
            }>()
          },
          states: {
            upload: {
              states: {
                done: {
                  schemas: { output: types<{ url: string }>() }
                }
              }
            },
            validate: {
              states: {
                done: {
                  schemas: { output: types<{ valid: boolean }>() }
                }
              }
            }
          }
        },
        complete: {}
      }
    });

    s.createMachine({
      initial: 'processing',
      states: {
        processing: {
          type: 'parallel',
          states: {
            upload: {
              initial: 'done',
              states: {
                done: {
                  type: 'final',
                  output: { url: '/file.png' }
                }
              }
            },
            validate: {
              initial: 'done',
              states: {
                done: {
                  type: 'final',
                  output: { valid: true }
                }
              }
            }
          },
          onDone: ({ event }) => {
            event.output.upload.url satisfies string;
            event.output.validate.valid satisfies boolean;
            // @ts-expect-error - the aggregate has no top-level `url` field
            event.output.url;
            return { target: 'complete' };
          }
        },
        complete: { type: 'final' }
      }
    });
  });
});
