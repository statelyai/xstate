import { z } from 'zod';
import {
  type AnyActorRef,
  type ActorLogicValidator,
  createActor,
  createAsyncLogic,
  createCallbackLogic,
  createEventObservableLogic,
  createLogic,
  createMachine,
  createSystem,
  createObservableLogic,
  initialTransition,
  setup,
  transition,
  types
} from '../src/index.ts';
import {
  ActorValidationError,
  isActorValidationError,
  standardSchemaValidator
} from '../src/validation/index.ts';

function getThrown(fn: () => void): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
}

function expectValidationError(
  error: unknown,
  boundary: ActorValidationError['boundary'],
  reason: ActorValidationError['reason'] = 'invalid'
) {
  expect(error).toBeInstanceOf(ActorValidationError);
  expect(isActorValidationError(error)).toBe(true);
  expect(error).toMatchObject({ boundary, reason });
}

describe('runtime schema validation', () => {
  it('validates setup schemas created through a system builder', () => {
    const machine = createSystem()
      .setup({
        validator: standardSchemaValidator(),
        schemas: { input: z.object({ count: z.number() }) }
      })
      .createMachine({});

    expectValidationError(
      getThrown(() => initialTransition(machine, { count: 'invalid' } as any)),
      'input'
    );
  });

  it('validates input across actor logic creators', () => {
    const input = z.object({ count: z.number() });
    const validator = standardSchemaValidator();
    const subscribable = {
      subscribe: () => ({ unsubscribe: () => {} })
    };
    const logics = [
      createLogic({
        validator,
        schemas: { input },
        context: undefined,
        run: () => undefined
      }),
      createAsyncLogic({
        validator,
        schemas: { input },
        run: async () => undefined
      }),
      createCallbackLogic({
        validator,
        schemas: { input },
        run: () => undefined
      }),
      createObservableLogic({
        validator,
        schemas: { input },
        run: () => subscribable
      }),
      createEventObservableLogic({
        validator,
        schemas: { input },
        run: () => subscribable
      })
    ];

    for (const logic of logics) {
      expectValidationError(
        getThrown(() =>
          initialTransition(logic as any, { count: 'invalid' } as any)
        ),
        'input'
      );
    }
  });

  it('validates generic actor output before returning it', () => {
    const effect = vi.fn();
    const logic = createLogic({
      validator: standardSchemaValidator(),
      schemas: { output: z.number() },
      context: undefined,
      run: (_, enq) => {
        enq.effect(effect);
        return { status: 'done', output: 'invalid' as any };
      }
    });

    expectValidationError(
      getThrown(() => initialTransition(logic)),
      'output'
    );

    const actor = createActor(logic);
    actor.subscribe({ error: () => {} });
    actor.start();
    expect(actor.getSnapshot().status).toBe('error');
    expect(effect).not.toHaveBeenCalled();
  });

  it('can be disabled by a derived setup', () => {
    const validated = setup({
      validator: standardSchemaValidator(),
      schemas: { input: z.object({ count: z.number() }) }
    });
    const unvalidated = validated.extend({ validator: undefined });

    expect(() =>
      initialTransition(unvalidated.createMachine({}), {
        count: 'not validated'
      } as any)
    ).not.toThrow();
  });

  it('can be installed by a derived setup', () => {
    const validated = setup({
      schemas: { input: z.object({ count: z.number() }) }
    }).extend({ validator: standardSchemaValidator() });

    expectValidationError(
      getThrown(() =>
        initialTransition(validated.createMachine({}), {
          count: 'invalid'
        } as any)
      ),
      'input'
    );
  });

  it('calls validators only at pure calculation boundaries', () => {
    const check = vi.fn<ActorLogicValidator['check']>(() => undefined);
    const machine = setup({ validator: { check } }).createMachine({
      on: {
        GO: (_, enq) => {
          enq.raise({ type: 'INTERNAL' });
        },
        INTERNAL: {}
      }
    });

    const [snapshot] = initialTransition(machine);
    expect(check.mock.calls.map(([request]) => request.kind)).toEqual([
      'input',
      'result'
    ]);

    check.mockClear();
    transition(machine, snapshot, { type: 'GO' });
    expect(check.mock.calls.map(([request]) => request.kind)).toEqual([
      'event',
      'result'
    ]);
  });

  it('validates input before initial context construction', () => {
    const context = vi.fn(() => ({ count: 0 }));
    const machine = setup({
      validator: standardSchemaValidator(),
      schemas: { input: z.object({ count: z.number() }) }
    }).createMachine({ context });

    const error = getThrown(() =>
      initialTransition(machine, { count: 'x' } as any)
    );

    expectValidationError(error, 'input');
    expect(context).not.toHaveBeenCalled();
  });

  it('does not validate the machine input schema as root state input', () => {
    const machine = setup({
      validator: standardSchemaValidator(),
      schemas: {
        input: z.object({ count: z.number() }),
        events: { GO: z.object({}) }
      }
    }).createMachine({
      initial: 'idle',
      states: { idle: { on: { GO: { target: 'done' } } }, done: {} }
    });

    const [snapshot] = initialTransition(machine, { count: 1 });
    expect(snapshot.value).toBe('idle');
    expect(transition(machine, snapshot, { type: 'GO' })[0].value).toBe('done');
  });

  it('validates external events before guard or transition selection', () => {
    const guard = vi.fn((_event: unknown) => true);
    const machine = setup({
      validator: standardSchemaValidator(),
      schemas: { events: { GO: z.object({ count: z.number() }) } }
    }).createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            GO: ({ event }) => (guard(event) ? { target: 'done' } : undefined)
          }
        },
        done: {}
      }
    });
    const [snapshot] = initialTransition(machine);

    expectValidationError(
      getThrown(() =>
        transition(machine, snapshot, { type: 'GO', count: 'x' } as any)
      ),
      'event'
    );
    expect(guard).not.toHaveBeenCalled();
  });

  it('validates separately declared internal event schemas', () => {
    const machine = setup({
      validator: standardSchemaValidator(),
      schemas: {
        events: { GO: z.object({}) },
        internalEvents: { TICK: z.object({ count: z.number() }) }
      }
    }).createMachine({
      initial: 'idle',
      states: {
        idle: { on: { TICK: { target: 'done' } } },
        done: {}
      }
    });
    const [snapshot] = initialTransition(machine);

    expectValidationError(
      getThrown(() =>
        transition(machine, snapshot, { type: 'TICK', count: 'x' } as any)
      ),
      'event'
    );
  });

  it('is strict for unknown events by default and supports open protocols', () => {
    const create = (unknownEvents?: 'error' | 'ignore') =>
      setup({
        validator: standardSchemaValidator({ unknownEvents }),
        schemas: { events: { KNOWN: z.object({}) } }
      }).createMachine({});

    const strict = create();
    const [strictSnapshot] = initialTransition(strict);
    expectValidationError(
      getThrown(() =>
        transition(strict, strictSnapshot, { type: 'UNKNOWN' } as any)
      ),
      'event',
      'unknownEvent'
    );

    const open = create('ignore');
    const [openSnapshot] = initialTransition(open);
    expect(() =>
      transition(open, openSnapshot, { type: 'UNKNOWN' } as any)
    ).not.toThrow();
  });

  it('validates stable root context after the macrostep', () => {
    const machine = setup({
      validator: standardSchemaValidator(),
      schemas: {
        context: z.object({ count: z.number() }),
        events: { BREAK: z.object({}) }
      }
    }).createMachine({
      context: { count: 0 },
      on: {
        BREAK: () => ({ context: { count: 'x' } as any })
      }
    });
    const [snapshot] = initialTransition(machine);

    expectValidationError(
      getThrown(() => transition(machine, snapshot, { type: 'BREAK' })),
      'context'
    );
  });

  it('does not validate immediate raised events in v1', () => {
    const raisedHandler = vi.fn();
    const machine = setup({
      validator: standardSchemaValidator(),
      schemas: {
        events: {
          GO: z.object({}),
          RAISED: z.object({ value: z.number() })
        }
      }
    }).createMachine({
      on: {
        GO: (_, enq) => {
          enq.raise({ type: 'RAISED', value: 'x' } as any);
        },
        RAISED: () => {
          raisedHandler();
        }
      }
    });
    const [snapshot] = initialTransition(machine);

    expect(() => transition(machine, snapshot, { type: 'GO' })).not.toThrow();
    expect(raisedHandler).toHaveBeenCalledOnce();
  });

  it('validates delayed raised events retained by the stable snapshot', () => {
    const machine = setup({
      validator: standardSchemaValidator(),
      schemas: { events: { LATER: z.object({ value: z.number() }) } }
    }).createMachine({
      entry: (_, enq) => {
        enq.raise({ type: 'LATER', value: 'x' } as any, { delay: 10 });
      }
    });

    const error = getThrown(() => initialTransition(machine));
    expectValidationError(error, 'event');
    expect(error).toMatchObject({ eventOrigin: 'raised' });
  });

  it('validates emitted events before any effect executes', () => {
    const action = vi.fn();
    const machine = setup({
      validator: standardSchemaValidator(),
      schemas: {
        events: { GO: z.object({}) },
        emitted: { notice: z.object({ value: z.number() }) }
      },
      actions: { action }
    }).createMachine({
      on: {
        GO: ({ actions }, enq) => {
          enq(actions.action);
          enq.emit({ type: 'notice', value: 'x' } as any);
        }
      }
    });
    const actor = createActor(machine);
    actor.subscribe({ error: () => {} });
    actor.start();
    actor.send({ type: 'GO' });

    expect(actor.getSnapshot().status).toBe('error');
    expectValidationError((actor.getSnapshot() as any).error, 'emitted');
    expect(action).not.toHaveBeenCalled();
  });

  it('is strict for unknown emitted events and supports open protocols', () => {
    const create = (unknownEmitted?: 'error' | 'ignore') =>
      setup({
        validator: standardSchemaValidator({ unknownEmitted }),
        schemas: { emitted: { known: z.object({}) } }
      }).createMachine({
        entry: (_, enq) => {
          enq.emit({ type: 'unknown' } as any);
        }
      });

    expectValidationError(
      getThrown(() => initialTransition(create())),
      'emitted',
      'unknownEmitted'
    );
    expect(() => initialTransition(create('ignore'))).not.toThrow();
  });

  it('surfaces terminal validation failures through transition inspection', () => {
    const inspection: any[] = [];
    const machine = setup({
      validator: standardSchemaValidator(),
      schemas: { events: { GO: z.object({ value: z.number() }) } }
    }).createMachine({});
    const actor = createActor(machine, {
      inspect: (event) => inspection.push(event)
    });
    actor.subscribe({ error: () => {} });
    actor.start();
    actor.send({ type: 'GO', value: 'x' } as any);

    const failure = inspection.find(
      (event) =>
        event.type === '@xstate.transition' &&
        event.event.type === 'GO' &&
        event.snapshot.status === 'error'
    );
    expect(failure).toBeDefined();
    expectValidationError(failure.snapshot.error, 'event');
    expect(failure.actions).toEqual([]);
    expect(failure.sent).toEqual([]);
    expect(failure.microsteps).toEqual([]);
  });

  it('does not expose rejected macrostep facets through inspection', () => {
    const inspection: any[] = [];
    const machine = setup({
      validator: standardSchemaValidator(),
      schemas: {
        context: z.object({ count: z.number() }),
        events: { BREAK: z.object({}) }
      }
    }).createMachine({
      context: { count: 0 },
      on: {
        BREAK: ({ context }) => ({
          context: { ...context, count: 'invalid' } as any
        })
      }
    });
    const actor = createActor(machine, {
      inspect: (event) => inspection.push(event)
    });
    actor.subscribe({ error: () => {} });
    actor.start();
    actor.send({ type: 'BREAK' });

    const failure = inspection.find(
      (event) =>
        event.type === '@xstate.transition' &&
        event.event.type === 'BREAK' &&
        event.snapshot.status === 'error'
    );
    expect(failure).toBeDefined();
    expectValidationError(failure.snapshot.error, 'context');
    expect(failure.actions).toEqual([]);
    expect(failure.sent).toEqual([]);
    expect(failure.microsteps).toEqual([]);
  });

  it('allows active onError handlers to recover validation failures', () => {
    const inspection: any[] = [];
    const machine = setup({
      validator: standardSchemaValidator(),
      schemas: {
        context: z.object({ count: z.number() }),
        events: { BREAK: z.object({}) }
      }
    }).createMachine({
      context: { count: 0 },
      initial: 'active',
      states: {
        active: {
          on: { BREAK: () => ({ context: { count: 'x' } as any }) },
          onError: { target: 'failed' }
        },
        failed: {}
      }
    });
    const actor = createActor(machine, {
      inspect: (event) => inspection.push(event)
    }).start();

    actor.send({ type: 'BREAK' });

    expect(actor.getSnapshot()).toMatchObject({
      status: 'active',
      value: 'failed'
    });
    const recovery = inspection.find(
      (event) =>
        event.type === '@xstate.transition' &&
        event.event.type === 'xstate.error.execution'
    );
    expect(recovery).toBeDefined();
    expectValidationError(recovery.event.error, 'context');
  });

  it('allows root onError to recover initial result validation failures', () => {
    const machine = setup({
      validator: standardSchemaValidator(),
      schemas: { context: z.object({ count: z.number() }) }
    }).createMachine({
      context: { count: 'invalid' } as any,
      initial: 'active',
      onError: () => ({
        target: '.recovered',
        context: { count: 0 }
      }),
      states: {
        active: {},
        recovered: {}
      }
    });

    const [snapshot] = initialTransition(machine);

    expect(snapshot).toMatchObject({
      status: 'active',
      value: 'recovered',
      context: { count: 0 }
    });
  });

  it('validates final output before completion', () => {
    const machine = setup({
      validator: standardSchemaValidator(),
      schemas: {
        events: { FINISH: z.object({}) },
        output: z.object({ total: z.number() })
      }
    }).createMachine({
      initial: 'active',
      states: {
        active: { on: { FINISH: { target: 'done' } } },
        done: { type: 'final', output: { total: 'x' } as any }
      }
    });
    const [snapshot] = initialTransition(machine);

    expectValidationError(
      getThrown(() => transition(machine, snapshot, { type: 'FINISH' })),
      'output'
    );
  });

  it('validates state input and state-local context in the stable snapshot', () => {
    const stateInputMachine = setup({
      validator: standardSchemaValidator(),
      schemas: { events: { GO: z.object({}) } },
      states: {
        done: { schemas: { input: z.object({ id: z.number() }) } }
      }
    }).createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: { GO: { target: 'done', input: { id: 'x' } as any } }
        },
        done: {}
      }
    });
    const [inputSnapshot] = initialTransition(stateInputMachine);
    expectValidationError(
      getThrown(() =>
        transition(stateInputMachine, inputSnapshot, { type: 'GO' })
      ),
      'state.input'
    );

    const stateContextMachine = setup({
      validator: standardSchemaValidator(),
      schemas: {
        context: z.object({ mode: z.string() }),
        events: { GO: z.object({}) }
      },
      states: {
        done: { schemas: { context: z.object({ mode: z.literal('done') }) } }
      }
    }).createMachine({
      context: { mode: 'idle' },
      initial: 'idle',
      states: {
        idle: { on: { GO: { target: 'done' } as any } },
        done: {}
      }
    });
    const [contextSnapshot] = initialTransition(stateContextMachine);
    expectValidationError(
      getThrown(() =>
        transition(stateContextMachine, contextSnapshot, { type: 'GO' })
      ),
      'state.context'
    );
  });

  it('does not validate named action and guard params in v1', () => {
    const action = vi.fn();
    const actionMachine = setup({
      validator: standardSchemaValidator(),
      schemas: {
        events: { GO: z.object({}) },
        actions: { track: { params: z.object({ count: z.number() }) } }
      },
      actions: { track: action }
    }).createMachine({
      on: {
        GO: ({ actions }, enq) => {
          enq(actions.track, { count: 'x' } as any);
        }
      }
    });
    const actionActor = createActor(actionMachine).start();
    actionActor.send({ type: 'GO' });
    expect(action).toHaveBeenCalledOnce();

    const guard = vi.fn(() => true);
    const guardMachine = setup({
      validator: standardSchemaValidator(),
      schemas: {
        events: { GO: z.object({}) },
        guards: { allowed: { params: z.object({ count: z.number() }) } }
      },
      guards: { allowed: guard }
    }).createMachine({
      on: {
        GO: ({ guards }) => {
          if (guards.allowed({ count: 'x' } as any)) {
            return {};
          }
        }
      }
    });
    const [guardSnapshot] = initialTransition(guardMachine);
    expect(() =>
      transition(guardMachine, guardSnapshot, { type: 'GO' })
    ).not.toThrow();
    expect(guard).toHaveBeenCalled();
  });

  it('validates declared child slots', () => {
    const child = createMachine({});
    const machine = setup({
      validator: standardSchemaValidator(),
      schemas: {
        children: {
          worker: z.custom<AnyActorRef>(() => false, 'invalid worker')
        }
      },
      actors: { worker: child }
    }).createMachine({ invoke: { id: 'worker', src: 'worker' } });

    expectValidationError(
      getThrown(() => initialTransition(machine)),
      'child'
    );
  });

  it('rejects async schemas and permits type-only schemas', async () => {
    const asyncMachine = setup({
      validator: standardSchemaValidator(),
      schemas: {
        events: {
          GO: z.object({}).refine(async () => true)
        }
      }
    }).createMachine({});
    const [snapshot] = initialTransition(asyncMachine);
    expectValidationError(
      getThrown(() => transition(asyncMachine, snapshot, { type: 'GO' })),
      'event',
      'asyncValidationUnsupported'
    );

    const rejectingSchema = {
      '~standard': {
        version: 1 as const,
        vendor: 'test',
        validate: () => Promise.reject(new Error('async schema failed'))
      }
    };
    const rejectingMachine = setup({
      validator: standardSchemaValidator(),
      schemas: { events: { GO: rejectingSchema } }
    }).createMachine({});
    const [rejectingSnapshot] = initialTransition(rejectingMachine);
    expectValidationError(
      getThrown(() =>
        transition(rejectingMachine, rejectingSnapshot, { type: 'GO' })
      ),
      'event',
      'asyncValidationUnsupported'
    );
    await Promise.resolve();

    const typeOnlyMachine = setup({
      validator: standardSchemaValidator(),
      schemas: { events: { GO: types<{ value: number }>() } }
    }).createMachine({});
    const [typeOnlySnapshot] = initialTransition(typeOnlyMachine);
    expect(() =>
      transition(typeOnlyMachine, typeOnlySnapshot, {
        type: 'GO',
        value: 'not checked'
      } as any)
    ).not.toThrow();
  });
});
