import {
  Context,
  Effect,
  Exit,
  Layer,
  ManagedRuntime,
  Option,
  Schema,
  Scope,
  Stream
} from 'effect';
import {
  createActor,
  createMachine,
  initialTransition,
  setup,
  types
} from 'xstate';
import { standardSchemaValidator } from 'xstate/validation';
import {
  createEffectActor,
  fromEffect,
  fromEffectEventStream,
  fromEffectStream,
  setupEffect
} from './index.ts';

const waitForEffects = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 0));

let scopes: Scope.Closeable[] = [];

afterEach(async () => {
  const pending = scopes;
  scopes = [];
  for (const scope of pending) {
    await Effect.runPromise(Scope.close(scope, Exit.void));
  }
});

/** Runs a scoped Effect in a scope that stays open until the test ends. */
const runScoped = async <A, E>(
  effect: Effect.Effect<A, E, Scope.Scope>
): Promise<A> => {
  const scope = await Effect.runPromise(Scope.make());
  scopes.push(scope);
  return Effect.runPromise(Scope.provide(effect, scope));
};

describe('@xstate/effect', () => {
  it('accepts Effect schemas in setupEffect with full type inference', async () => {
    const effectSetup = setupEffect({
      schemas: {
        context: Schema.Struct({ count: Schema.Number }),
        events: {
          ADD: Schema.Struct({ value: Schema.Number }),
          RESET: types<{}>()
        }
      }
    });
    const machine = effectSetup.createMachine({
      context: { count: 0 },
      initial: 'active',
      states: {
        active: {
          on: {
            ADD: ({ context, event }) => {
              context.count satisfies number;
              event.value satisfies number;
              return { context: { count: context.count + event.value } };
            },
            RESET: { context: { count: 0 } }
          }
        }
      }
    });

    const actor = await runScoped(createEffectActor(machine));
    actor.send({ type: 'ADD', value: 3 });
    const sendInvalidEvent = () => {
      // @ts-expect-error -- Effect schemas constrain event payloads
      actor.send({ type: 'ADD', value: 'invalid' });
    };
    void sendInvalidEvent;

    expect(actor.getSnapshot().context).toEqual({ count: 3 });
    expect(machine.schemas?.context?.['~standard'].vendor).toBe('effect');
  });

  it('accepts Effect schemas when extending setupEffect', async () => {
    const effectSetup = setupEffect({
      schemas: {
        context: Schema.Struct({ count: Schema.Number })
      }
    }).extend({
      schemas: {
        events: {
          ADD: Schema.Struct({ value: Schema.Number })
        }
      },
      guards: {
        canAdd: ({ context, event }) => {
          context.count satisfies number;
          event.value satisfies number;
          return event.value > 0;
        }
      }
    });
    const machine = effectSetup.createMachine({
      context: { count: 0 },
      on: {
        ADD: {
          context: ({ context, event }) => ({
            count: context.count + event.value
          })
        }
      }
    });
    const actor = await runScoped(createEffectActor(machine));

    actor.send({ type: 'ADD', value: 2 });

    expect(actor.getSnapshot().context).toEqual({ count: 2 });
    expect(effectSetup.schemas.events.ADD['~standard'].vendor).toBe('effect');
  });

  it('preserves runtime validation compatibility through setupEffect.extend', () => {
    const validated = setupEffect({
      validator: standardSchemaValidator()
    });
    const incompatibleSchemas = setupEffect({
      schemas: { input: Schema.NumberFromString }
    });
    const incompatibleStates = setupEffect({
      states: {
        loading: { schemas: { input: Schema.NumberFromString } }
      }
    });

    if (false) {
      validated.extend({
        schemas: {
          // @ts-expect-error -- extended schemas inherit runtime validation
          input: Schema.NumberFromString
        }
      });

      // @ts-expect-error -- validation cannot be installed over a transforming schema
      incompatibleSchemas.extend({ validator: standardSchemaValidator() });

      // @ts-expect-error -- inherited state schemas must also be compatible
      incompatibleStates.extend({ validator: standardSchemaValidator() });
    }

    validated.extend({
      validator: undefined,
      schemas: { input: Schema.NumberFromString }
    });
  });

  it('preserves Effect action requirements when extending setupEffect', () => {
    const Audit = Context.Service<{ record: () => void }>('Audit');
    const machine = setupEffect()
      .extend({
        actions: {
          audit: (_args) =>
            Audit.use((audit) => Effect.sync(() => audit.record()))
        }
      })
      .createMachine({
        on: {
          AUDIT: (args, enq) => enq(args.actions.audit, args)
        }
      });
    const runWithoutAudit = () => {
      // @ts-expect-error -- extended Effect actions contribute requirements
      runScoped(createEffectActor(machine));
    };

    void runWithoutAudit;
  });

  it('converts nested Effect state schemas', () => {
    const effectSetup = setupEffect({
      states: {
        running: {
          schemas: {
            input: Schema.Struct({ timeout: Schema.Number })
          },
          states: {
            retrying: {
              schemas: {
                context: Schema.Struct({ attempt: Schema.Number })
              }
            }
          }
        }
      }
    });

    expect(
      effectSetup.states.running.schemas?.input?.['~standard'].vendor
    ).toBe('effect');
    expect(
      effectSetup.states.running.states?.retrying.schemas?.context?.[
        '~standard'
      ].vendor
    ).toBe('effect');
  });

  it('converts Effect schemas in every setup schema map', () => {
    const effectSetup = setupEffect({
      schemas: {
        internalEvents: {
          TICK: Schema.Struct({ count: Schema.Number })
        },
        actions: {
          track: { params: Schema.Struct({ key: Schema.String }) }
        },
        guards: {
          hasAccess: { params: Schema.Struct({ role: Schema.String }) }
        },
        emitted: {
          changed: Schema.Struct({ value: Schema.Number })
        },
        meta: Schema.Struct({ label: Schema.String }),
        tags: Schema.Literals(['active']),
        children: {
          child: Schema.Unknown
        }
      }
    });

    expect(
      [
        effectSetup.schemas.internalEvents.TICK,
        effectSetup.schemas.actions.track.params,
        effectSetup.schemas.guards.hasAccess.params,
        effectSetup.schemas.emitted.changed,
        effectSetup.schemas.meta,
        effectSetup.schemas.tags,
        effectSetup.schemas.children.child
      ].every((schema) => schema['~standard'].vendor === 'effect')
    ).toBe(true);
  });

  it('preserves __proto__ schema and state keys while converting', () => {
    const effectSetup = setupEffect({
      schemas: {
        events: { ['__proto__']: Schema.String }
      },
      states: {
        ['__proto__']: {
          schemas: { input: Schema.String }
        }
      }
    });

    expect(Object.hasOwn(effectSetup.schemas.events, '__proto__')).toBe(true);
    expect(effectSetup.schemas.events['__proto__']['~standard'].vendor).toBe(
      'effect'
    );
    expect(Object.hasOwn(effectSetup.states, '__proto__')).toBe(true);
    expect(
      effectSetup.states['__proto__'].schemas?.input?.['~standard'].vendor
    ).toBe('effect');
  });

  it('uses converted Effect schemas with XState runtime validation', () => {
    const machine = setupEffect({
      validator: standardSchemaValidator(),
      schemas: {
        input: Schema.Struct({ count: Schema.Number })
      }
    }).createMachine({
      context: ({ input }) => ({ count: input.count })
    });

    expect(() =>
      initialTransition(machine, { count: 'invalid' } as any)
    ).toThrow('Invalid input');
  });

  it('reports asynchronous Effect schemas as unsupported by runtime validation', () => {
    const asyncString = Schema.String.pipe(
      Schema.catchDecoding(() =>
        Effect.delay(Effect.succeed(Option.some('fallback')), 1)
      )
    );
    const machine = setupEffect({
      validator: standardSchemaValidator(),
      schemas: { input: asyncString }
    }).createMachine({});

    expect(() => initialTransition(machine, 42 as any)).toThrow(
      'Async schema validation is unsupported for input'
    );
  });

  it('rejects transforming Effect schemas when runtime validation is enabled', () => {
    const invalidSetup = () =>
      setupEffect({
        validator: standardSchemaValidator(),
        schemas: {
          // @ts-expect-error -- XState validation asserts values but does not transform them
          input: Schema.NumberFromString
        }
      });
    const invalidLogic = () =>
      fromEffect({
        // @ts-expect-error -- XState validation asserts values but does not transform them
        validator: standardSchemaValidator(),
        schemas: {
          input: Schema.NumberFromString
        },
        effect: ({ input }: { input: number }) => Effect.succeed(input)
      });

    void invalidSetup;
    void invalidLogic;
  });

  it('accepts Effect schemas for fromEffect input and output', async () => {
    const logic = fromEffect({
      schemas: {
        input: Schema.Struct({ id: Schema.String }),
        output: Schema.Struct({ greeting: Schema.String })
      },
      effect: ({ input }) => {
        input.id satisfies string;
        return Effect.succeed({ greeting: `Hello ${input.id}` });
      }
    });

    const actor = await runScoped(
      createEffectActor(logic, { input: { id: '42' } })
    );
    const createWithInvalidInput = () => {
      // @ts-expect-error -- input comes from the Effect schema
      createEffectActor(logic, { input: { id: 42 } });
    };
    void createWithInvalidInput;
    await waitForEffects();

    actor.getSnapshot().output?.greeting satisfies string | undefined;
    expect(actor.getSnapshot().output).toEqual({ greeting: 'Hello 42' });
    expect((logic.config as any).schemas.input['~standard'].vendor).toBe(
      'effect'
    );
  });

  it('checks fromEffect results against the output schema', () => {
    const invalidLogic = () =>
      fromEffect({
        // @ts-expect-error -- the Effect result must match the output schema
        schemas: { output: Schema.String },
        effect: Effect.succeed(42)
      });

    void invalidLogic;
  });

  it('preserves failures and requirements with input and output schemas', () => {
    const Service = Context.Service<{ name: string }>('Service');
    const failure = { code: 'NOT_FOUND' as const };
    const logic = fromEffect({
      schemas: {
        input: Schema.Struct({ id: Schema.String }),
        output: Schema.Struct({ name: Schema.String })
      },
      effect: ({ input }) =>
        Service.use((service) =>
          input.id === 'missing'
            ? Effect.fail(failure)
            : Effect.succeed({ name: service.name })
        )
    });
    setup({ actors: { logic } }).createMachine({
      invoke: {
        src: 'logic',
        input: { id: '42' },
        onError: ({ event }) => {
          event.error.code satisfies 'NOT_FOUND';
          return {};
        }
      }
    });
    const runWithoutService = () => {
      Effect.runPromise(
        // @ts-expect-error -- both-schema actors preserve Effect requirements
        createEffectActor(logic, { input: { id: '42' } })
      );
    };

    void runWithoutService;
  });

  it('infers fromEffect output and requirements with only an input schema', () => {
    const Service = Context.Service<{ prefix: string }>('Service');
    const logic = fromEffect({
      schemas: {
        input: Schema.Struct({ id: Schema.String })
      },
      effect: ({ input }) =>
        Service.use((service) => Effect.succeed(`${service.prefix}${input.id}`))
    });

    const runWithoutService = () => {
      // @ts-expect-error -- schema inference preserves Effect requirements
      runScoped(createEffectActor(logic, { input: { id: '42' } }));
    };
    void runWithoutService;
  });

  it('accepts a constant Effect with only an input schema', async () => {
    const logic = fromEffect({
      schemas: {
        input: Schema.Struct({ id: Schema.String })
      },
      effect: Effect.succeed('ok')
    });
    const actor = await runScoped(
      createEffectActor(logic, { input: { id: '42' } })
    );
    await waitForEffects();

    expect(actor.getSnapshot().output).toBe('ok');
  });

  it('accepts an output-only Effect schema', async () => {
    const logic = fromEffect({
      schemas: { output: Schema.String },
      effect: Effect.succeed('ok')
    });
    const actor = await runScoped(createEffectActor(logic));
    await waitForEffects();

    actor.getSnapshot().output satisfies string | undefined;
    expect(actor.getSnapshot().output).toBe('ok');
  });

  it('infers actor input with only an output schema', async () => {
    const logic = fromEffect({
      schemas: { output: Schema.String },
      effect: ({ input }: { input: number }) => Effect.succeed(String(input))
    });
    const actor = await runScoped(createEffectActor(logic, { input: 42 }));
    await waitForEffects();

    expect(actor.getSnapshot().output).toBe('42');
  });

  it('validates fromEffect schemas when a validator is provided', async () => {
    const logic = fromEffect({
      validator: standardSchemaValidator(),
      schemas: { output: Schema.String },
      effect: Effect.succeed('ok')
    });
    const actor = await runScoped(createEffectActor(logic));
    await waitForEffects();

    expect(actor.getSnapshot().status).toBe('done');
  });

  it('rejects invalid fromEffect output with XState runtime validation', async () => {
    let resolve!: (value: number) => void;
    const output = new Promise<number>((done) => {
      resolve = done;
    });
    const logic = fromEffect({
      validator: standardSchemaValidator(),
      schemas: { output: Schema.String },
      effect: Effect.promise(() => output) as Effect.Effect<any>
    });
    const errors: unknown[] = [];
    const actor = await runScoped(createEffectActor(logic));
    actor.subscribe({ error: (error) => errors.push(error) });
    resolve(42);
    await waitForEffects();

    expect(actor.getSnapshot().status).toBe('error');
    expect(errors).toHaveLength(1);
  });

  it('runs setupEffect actions inside the host Effect context', async () => {
    interface Audit {
      record: (value: number) => void;
    }
    const Audit = Context.Service<Audit>('Audit');
    const recorded: number[] = [];

    const effectSetup = setupEffect({
      actions: {
        audit: ({ context }) =>
          Audit.use((audit) => Effect.sync(() => audit.record(context.count)))
      }
    });
    const machine = effectSetup.createMachine({
      context: { count: 1 },
      initial: 'active',
      states: {
        active: {
          on: {
            AUDIT: (args, enq) => {
              enq(args.actions.audit, args);
            }
          }
        }
      }
    });

    const actor = await runScoped(
      Effect.provideService(createEffectActor(machine), Audit, {
        record: (value) => recorded.push(value)
      })
    );
    const runWithoutAudit = () => {
      // @ts-expect-error -- the actor requires the Audit service
      runScoped(createEffectActor(machine));
    };
    void runWithoutAudit;

    actor.send({ type: 'AUDIT' });
    await waitForEffects();

    expect(recorded).toEqual([1]);
  });

  it('uses scoped Layer services while the caller-owned runtime is alive', async () => {
    const Resource = Context.Service<{ value: string }>('Resource');
    let acquired = 0;
    let released = 0;
    let observed: string | undefined;
    const layer = Layer.effect(
      Resource,
      Effect.acquireRelease(
        Effect.sync(() => {
          acquired++;
          return { value: 'scoped' };
        }),
        () =>
          Effect.sync(() => {
            released++;
          })
      )
    );
    const runtime = ManagedRuntime.make(layer);
    const machine = setupEffect({
      actions: {
        read: (_args) =>
          Resource.use((resource) =>
            Effect.sync(() => {
              observed = resource.value;
            })
          )
      }
    }).createMachine({
      on: {
        READ: (args, enq) => enq(args.actions.read, args)
      }
    });

    try {
      const scope = await runtime.runPromise(Scope.make());
      scopes.push(scope);
      const actor = await runtime.runPromise(
        Scope.provide(createEffectActor(machine), scope)
      );

      expect(acquired).toBe(1);
      expect(released).toBe(0);
      actor.send({ type: 'READ' });
      await waitForEffects();
      expect(observed).toBe('scoped');

      actor.stop();
      expect(released).toBe(0);
    } finally {
      await runtime.dispose();
    }

    expect(released).toBe(1);
  });

  it('routes failed Effect actions through the machine error transition', async () => {
    const failure = { code: 'AUDIT_FAILED' as const };
    let received: unknown;
    const effectSetup = setupEffect({
      actions: {
        fail: (_args) => Effect.fail(failure)
      }
    });
    const machine = effectSetup.createMachine({
      initial: 'active',
      states: {
        active: {
          on: {
            FAIL: (args, enq) => enq(args.actions.fail, args)
          },
          onError: ({ event }) => {
            received = event.error;
            return { target: 'failed' };
          }
        },
        failed: {}
      }
    });

    const actor = await runScoped(createEffectActor(machine));
    actor.send({ type: 'FAIL' });
    await waitForEffects();

    expect(actor.getSnapshot().value).toBe('failed');
    expect(received).toEqual(failure);
  });

  it('invokes an Effect actor and routes success to onDone', async () => {
    const logic = fromEffect(Effect.succeed('ok'));
    const machine = createMachine({
      initial: 'pending',
      states: {
        pending: {
          invoke: {
            src: logic,
            onDone: {
              target: 'success',
              context: ({ event }) => ({ result: event.output })
            }
          }
        },
        success: {}
      }
    });

    const actor = await runScoped(createEffectActor(machine));
    await waitForEffects();

    expect(actor.getSnapshot().value).toBe('success');
    expect(actor.getSnapshot().context).toEqual({ result: 'ok' });
  });

  it('uses the Effect runtime brand when distinguishing config objects', async () => {
    const directEffect = Object.assign(Effect.succeed('direct'), {
      effect: Effect.succeed('nested')
    });
    const actor = await runScoped(createEffectActor(fromEffect(directEffect)));
    await waitForEffects();

    expect(actor.getSnapshot().output).toBe('direct');
  });

  it('routes typed Effect failures to onError', async () => {
    const failure = { code: 'NOT_FOUND' as const };
    const logic = fromEffect(Effect.fail(failure));
    const machine = createMachine({
      initial: 'pending',
      states: {
        pending: {
          invoke: {
            src: logic,
            onError: {
              target: 'failed',
              context: ({ event }) => ({ error: event.error })
            }
          }
        },
        failed: {}
      }
    });

    const actor = await runScoped(createEffectActor(machine));
    await waitForEffects();

    expect(actor.getSnapshot().value).toBe('failed');
    expect(actor.getSnapshot().context).toEqual({ error: failure });
  });

  it('preserves typed Effect errors through registered v6 actors', () => {
    const failure = { code: 'NOT_FOUND' as const };
    const request = fromEffect(Effect.fail(failure));
    const effectSetup = setupEffect({ actors: { request } });
    const machine = effectSetup.createMachine({
      initial: 'pending',
      states: {
        pending: {
          invoke: {
            src: 'request',
            onError: ({ event }) => {
              const code: 'NOT_FOUND' = event.error.code;
              // @ts-expect-error -- the Effect failure is discriminated
              const other: 'OTHER' = code;
              void other;
              return { target: 'failed' };
            }
          }
        },
        failed: {}
      }
    });

    expect(machine).toBeDefined();
  });

  it('collects requirements from registered Effect actors', () => {
    const Service = Context.Service<{ value: number }>('Service');
    const logic = fromEffect(
      Service.use((service) => Effect.succeed(service.value))
    );
    const runWithoutService = () => {
      // @ts-expect-error -- the actor requires Service
      runScoped(createEffectActor(logic));
    };
    void runWithoutService;
    const machine = setup({ actors: { logic } }).createMachine({
      initial: 'pending',
      states: {
        pending: {
          invoke: { src: 'logic' }
        }
      }
    });

    const runWithoutRegisteredService = () => {
      // @ts-expect-error -- the registered actor requires Service
      runScoped(createEffectActor(machine));
    };
    void runWithoutRegisteredService;
  });

  it('rejects running Effect logic through ordinary createActor', () => {
    const actor = createActor(fromEffect(Effect.succeed('ok')));
    actor.subscribe({ error: () => {} });
    actor.start();

    expect(actor.getSnapshot().status).toBe('error');
  });

  it('exposes the latest item from an Effect stream and completes', async () => {
    const actor = await runScoped(
      createEffectActor(fromEffectStream(Stream.make(1, 2, 3)))
    );
    await waitForEffects();

    expect(actor.getSnapshot().context).toBe(3);
    expect(actor.getSnapshot().status).toBe('done');
  });

  it('relays an Effect event stream to its parent', async () => {
    const machine = createMachine({
      context: { seen: 0 },
      schemas: { events: { VALUE: types<{ value: number }>() } },
      initial: 'active',
      states: {
        active: {
          invoke: {
            src: fromEffectEventStream(
              Stream.make(
                { type: 'VALUE', value: 1 },
                { type: 'VALUE', value: 2 }
              )
            )
          },
          on: {
            VALUE: {
              context: ({ context, event }) => ({
                seen: context.seen + event.value
              })
            }
          }
        }
      }
    });

    const actor = await runScoped(createEffectActor(machine));
    await waitForEffects();

    expect(actor.getSnapshot().context).toEqual({ seen: 3 });
  });

  it('interrupts a running Effect actor when it is stopped', async () => {
    let interrupted = false;
    const logic = fromEffect(
      Effect.ensuring(
        Effect.never,
        Effect.sync(() => {
          interrupted = true;
        })
      )
    );
    const actor = await runScoped(createEffectActor(logic));

    actor.stop();
    await waitForEffects();

    expect(interrupted).toBe(true);
    expect(actor.getSnapshot().status).toBe('stopped');
  });

  it('interrupts an invoked Effect actor when its state is exited', async () => {
    let interrupted = false;
    const worker = fromEffect(
      Effect.ensuring(
        Effect.never,
        Effect.sync(() => {
          interrupted = true;
        })
      )
    );
    const machine = setup({ actors: { worker } }).createMachine({
      context: {},
      initial: 'loading',
      states: {
        loading: {
          invoke: {
            src: 'worker'
          },
          on: {
            CANCEL: { target: 'cancelled' }
          }
        },
        cancelled: {}
      }
    });
    const actor = await runScoped(createEffectActor(machine));

    actor.send({ type: 'CANCEL' });
    await waitForEffects();

    expect(interrupted).toBe(true);
    expect(actor.getSnapshot().value).toBe('cancelled');
    actor.stop();
  });

  it('interrupts a running Effect action when its actor is stopped', async () => {
    let interrupted = false;
    const effectSetup = setupEffect({
      actions: {
        work: (_args) =>
          Effect.ensuring(
            Effect.never,
            Effect.sync(() => {
              interrupted = true;
            })
          )
      }
    });
    const machine = effectSetup.createMachine({
      initial: 'active',
      states: {
        active: {
          on: {
            WORK: (args, enq) => enq(args.actions.work, args)
          }
        }
      }
    });
    const actor = await runScoped(createEffectActor(machine));

    actor.send({ type: 'WORK' });
    actor.stop();
    await waitForEffects();

    expect(interrupted).toBe(true);
  });

  it('restarts an unkeyed Effect actor from persisted state', async () => {
    let runs = 0;
    const logic = fromEffect(() => {
      runs += 1;
      return Effect.never;
    });

    const actor = await runScoped(createEffectActor(logic));
    const persisted = actor.getPersistedSnapshot();
    actor.stop();

    const restoredActor = await runScoped(
      createEffectActor(logic, { snapshot: persisted })
    );

    expect(runs).toBe(2);
    restoredActor.stop();
  });
});
