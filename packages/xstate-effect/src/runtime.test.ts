import { Context, Effect, Exit, Schema, Scope, Stream } from 'effect';
import { TestClock } from 'effect/testing';
import {
  SimulatedClock,
  createMachine,
  setup,
  types,
  type Actor,
  type AnyActorRef
} from 'xstate';
import {
  EffectInterruptedError,
  createEffectActor,
  fromEffect,
  fromEffectEventStream,
  fromEffectStream,
  runEffect,
  setupEffect
} from './index.ts';

const waitForEffects = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Polls until `predicate` holds, instead of sleeping for a fixed duration. */
const waitUntil = async (predicate: () => boolean, timeoutMs = 2000) => {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
};

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

describe('@xstate/effect runtime', () => {
  it('stops the actor and interrupts its Effect when the enclosing scope closes', async () => {
    let interrupted = false;
    const logic = fromEffect(
      Effect.ensuring(
        Effect.never,
        Effect.sync(() => {
          interrupted = true;
        })
      )
    );
    let actor!: Actor<typeof logic>;

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          actor = yield* createEffectActor(logic);

          expect(actor.getSnapshot().status).toBe('active');
          expect(interrupted).toBe(false);
        })
      )
    );

    expect(actor.getSnapshot().status).toBe('stopped');
    expect(interrupted).toBe(true);
  });

  it('releases actor-scoped finalizers when the actor is stopped', async () => {
    let released = 0;
    const logic = fromEffect(
      Effect.gen(function* () {
        yield* Effect.addFinalizer(() =>
          Effect.sync(() => {
            released++;
          })
        );
        return yield* Effect.never;
      })
    );
    const actor = await runScoped(createEffectActor(logic));
    await waitForEffects();

    expect(released).toBe(0);

    actor.stop();
    await waitForEffects();

    expect(released).toBe(1);
  });

  it('releases actor-scoped finalizers when the enclosing scope closes', async () => {
    let released = 0;

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* createEffectActor(
            fromEffect(
              Effect.gen(function* () {
                yield* Effect.addFinalizer(() =>
                  Effect.sync(() => {
                    released++;
                  })
                );
                return yield* Effect.never;
              })
            )
          );
          yield* Effect.promise(waitForEffects);

          expect(released).toBe(0);
        })
      )
    );

    expect(released).toBe(1);
  });

  it('keeps actor-scoped finalizers open after the Effect itself completes', async () => {
    let released = 0;
    const machine = setupEffect({
      actions: {
        work: (_args) =>
          Effect.gen(function* () {
            yield* Effect.addFinalizer(() =>
              Effect.sync(() => {
                released++;
              })
            );
          })
      }
    }).createMachine({
      on: {
        WORK: (args, enq) => enq(args.actions.work, args)
      }
    });
    const actor = await runScoped(createEffectActor(machine));

    actor.send({ type: 'WORK' });
    await waitForEffects();

    expect(released).toBe(0);
    expect(actor.getSnapshot().status).toBe('active');

    actor.stop();
    await waitForEffects();

    expect(released).toBe(1);
  });

  it('drives delayed transitions with the Effect clock', async () => {
    const machine = createMachine({
      initial: 'green',
      states: {
        green: { after: { 1000: { target: 'yellow' } } },
        yellow: {}
      }
    });

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const actor = yield* createEffectActor(machine);

          yield* Effect.promise(waitForEffects);
          expect(actor.getSnapshot().value).toBe('green');

          yield* TestClock.adjust('1 second');
          yield* Effect.promise(waitForEffects);

          expect(actor.getSnapshot().value).toBe('yellow');
        })
      ).pipe(Effect.provide(TestClock.layer()))
    );
  });

  it('uses options.clock instead of the Effect clock', async () => {
    const clock = new SimulatedClock();
    const machine = createMachine({
      initial: 'green',
      states: {
        green: { after: { 1000: { target: 'yellow' } } },
        yellow: {}
      }
    });

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const actor = yield* createEffectActor(machine, { clock });

          // The Effect clock is not driving these timers anymore.
          yield* TestClock.adjust('1 second');
          expect(actor.getSnapshot().value).toBe('green');

          clock.increment(1000);
          expect(actor.getSnapshot().value).toBe('yellow');
        })
      ).pipe(Effect.provide(TestClock.layer()))
    );
  });

  it('reports self-interruption as an EffectInterruptedError', async () => {
    const actor = await runScoped(
      createEffectActor(fromEffect(Effect.interrupt))
    );
    await waitForEffects();

    const snapshot = actor.getSnapshot();
    const error: unknown = snapshot.error;
    expect(snapshot.status).toBe('error');
    expect(error).toBeInstanceOf(EffectInterruptedError);
    expect((error as EffectInterruptedError)._tag).toBe(
      'EffectInterruptedError'
    );
  });

  it('routes an interrupted invoked Effect to onError', async () => {
    let received: unknown;
    const worker = fromEffect(Effect.interrupt);
    const machine = setup({ actors: { worker } }).createMachine({
      initial: 'pending',
      states: {
        pending: {
          invoke: {
            src: 'worker',
            onError: ({ event }) => {
              received = event.error;
              return { target: 'failed' };
            }
          }
        },
        failed: {}
      }
    });

    const actor = await runScoped(createEffectActor(machine));
    await waitForEffects();

    expect(actor.getSnapshot().value).toBe('failed');
    expect(received).toBeInstanceOf(EffectInterruptedError);
  });

  it('does not report interruption when the invoking state exits', async () => {
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
      initial: 'working',
      states: {
        working: {
          invoke: { src: 'worker', id: 'worker' },
          on: { CANCEL: { target: 'cancelled' } }
        },
        cancelled: {}
      }
    });

    const actor = await runScoped(createEffectActor(machine));
    const child = actor.getSnapshot().children.worker;

    actor.send({ type: 'CANCEL' });
    await waitForEffects();

    expect(interrupted).toBe(true);
    expect(actor.getSnapshot().value).toBe('cancelled');
    expect(actor.getSnapshot().status).toBe('active');
    expect(child?.getSnapshot().status).toBe('stopped');
    expect(child?.getSnapshot().error).toBeUndefined();
  });

  it('does not report interruption of an Effect that loses an internal race', async () => {
    let loserReleased = false;
    const logic = fromEffect(
      Effect.race(
        Effect.as(Effect.sleep('5 millis'), 'winner'),
        Effect.ensuring(
          Effect.never,
          Effect.sync(() => {
            loserReleased = true;
          })
        )
      )
    );

    const actor = await runScoped(createEffectActor(logic));
    await waitUntil(() => actor.getSnapshot().status === 'done');

    expect(actor.getSnapshot().output).toBe('winner');
    expect(actor.getSnapshot().error).toBeUndefined();
    expect(loserReleased).toBe(true);
  });

  it('emits events from the fromEffect source args', async () => {
    const emitted: Array<{ type: string; value: number }> = [];
    const logic = fromEffect(({ emit }) =>
      Effect.gen(function* () {
        yield* Effect.yieldNow;
        emit({ type: 'progress', value: 1 });
        emit({ type: 'progress', value: 2 });
        return 'done';
      })
    );

    const actor = await runScoped(createEffectActor(logic));
    actor.on('progress', (event) =>
      emitted.push(event as { type: string; value: number })
    );
    await waitForEffects();

    expect(emitted).toEqual([
      { type: 'progress', value: 1 },
      { type: 'progress', value: 2 }
    ]);
    expect(actor.getSnapshot().output).toBe('done');
  });

  it('runs an inline runEffect action in the host Effect context', async () => {
    const Config = Context.Service<{ value: number }>('Config');
    let observed: number | undefined;
    const machine = createMachine({
      on: {
        READ: (args, enq) =>
          enq(
            runEffect,
            args.self,
            Config.use((config) =>
              Effect.sync(() => {
                observed = config.value;
              })
            )
          )
      }
    });

    const actor = await runScoped(
      Effect.provideService(createEffectActor(machine), Config, { value: 7 })
    );
    actor.send({ type: 'READ' });
    await waitForEffects();

    expect(observed).toBe(7);
  });

  it('routes a failing inline runEffect action to onError', async () => {
    const failure = { code: 'BOOM' as const };
    let received: unknown;
    const machine = createMachine({
      initial: 'active',
      states: {
        active: {
          on: {
            FAIL: (args, enq) => enq(runEffect, args.self, Effect.fail(failure))
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

  it('interrupts an inline runEffect action when the actor stops', async () => {
    let interrupted = false;
    const machine = createMachine({
      on: {
        WORK: (args, enq) =>
          enq(
            runEffect,
            args.self,
            Effect.ensuring(
              Effect.never,
              Effect.sync(() => {
                interrupted = true;
              })
            )
          )
      }
    });

    const actor = await runScoped(createEffectActor(machine));
    actor.send({ type: 'WORK' });
    await waitForEffects();

    expect(interrupted).toBe(false);

    actor.stop();
    await waitForEffects();

    expect(interrupted).toBe(true);
  });

  it('infers stream input from the fromEffectStream config form', async () => {
    const logic = fromEffectStream({
      schemas: { input: Schema.Struct({ n: Schema.Number }) },
      stream: ({ input }) => {
        input satisfies { readonly n: number };
        return Stream.make(input.n, input.n + 1);
      }
    });

    const actor = await runScoped(
      createEffectActor(logic, { input: { n: 5 } })
    );
    await waitForEffects();

    expect(actor.getSnapshot().context).toBe(6);
    expect(actor.getSnapshot().status).toBe('done');
  });

  it('relays a configured Effect event stream to its parent', async () => {
    const relay = fromEffectEventStream({
      schemas: { input: Schema.Struct({ n: Schema.Number }) },
      stream: ({ input }) => {
        input satisfies { readonly n: number };
        return Stream.make(
          { type: 'VALUE' as const, value: input.n },
          { type: 'VALUE' as const, value: input.n * 2 }
        );
      }
    });
    const machine = setup({
      schemas: { events: { VALUE: types<{ value: number }>() } },
      actors: { relay }
    }).createMachine({
      context: { seen: 0 },
      initial: 'active',
      states: {
        active: {
          invoke: { src: 'relay', input: { n: 3 } },
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

    expect(actor.getSnapshot().context).toEqual({ seen: 9 });
  });

  it('reports a failing Effect stream as an actor error', async () => {
    const failure = { code: 'STREAM_FAILED' as const };
    const actor = await runScoped(
      createEffectActor(fromEffectStream(Stream.fail(failure)))
    );
    await waitForEffects();

    expect(actor.getSnapshot().status).toBe('error');
    expect(actor.getSnapshot().error).toEqual(failure);
  });

  it('interrupts an Effect stream when the invoking state exits', async () => {
    let interrupted = false;
    const worker = fromEffectStream(
      Stream.fromEffect(
        Effect.ensuring(
          Effect.never,
          Effect.sync(() => {
            interrupted = true;
          })
        )
      )
    );
    const machine = setup({ actors: { worker } }).createMachine({
      initial: 'streaming',
      states: {
        streaming: {
          invoke: { src: 'worker' },
          on: { CANCEL: { target: 'cancelled' } }
        },
        cancelled: {}
      }
    });

    const actor = await runScoped(createEffectActor(machine));
    actor.send({ type: 'CANCEL' });
    await waitForEffects();

    expect(interrupted).toBe(true);
    expect(actor.getSnapshot().value).toBe('cancelled');
  });

  it('resolves the Effect host through the parent chain', async () => {
    const Greeting = Context.Service<{ value: string }>('Greeting');
    const leaf = fromEffect(
      Greeting.use((greeting) => Effect.succeed(greeting.value))
    );
    const child = setup({ actors: { leaf } }).createMachine({
      context: { greeting: '' },
      initial: 'pending',
      states: {
        pending: {
          invoke: {
            src: 'leaf',
            onDone: {
              target: 'done',
              context: ({ event }) => ({ greeting: event.output })
            }
          }
        },
        done: { type: 'final' }
      }
    });
    const root = setup({ actors: { child } }).createMachine({
      initial: 'pending',
      states: {
        pending: {
          invoke: { src: 'child', id: 'child', onDone: { target: 'done' } }
        },
        done: {}
      }
    });

    const actor = await runScoped(
      Effect.provideService(createEffectActor(root), Greeting, {
        value: 'from the root'
      })
    );
    await waitUntil(() => actor.getSnapshot().value === 'done');

    expect(actor.getSnapshot().value).toBe('done');
  });

  it('runs spawned Effect logic in the host Effect context', async () => {
    const Greeting = Context.Service<{ value: string }>('Greeting');
    const leaf = fromEffect(
      Greeting.use((greeting) => Effect.succeed(greeting.value))
    );
    const machine = setup({ actors: { leaf } }).createMachine({
      context: { ref: undefined as AnyActorRef | undefined },
      entry: ({ actors }, enq) => ({
        context: { ref: enq.spawn(actors.leaf) }
      })
    });

    const actor = await runScoped(
      Effect.provideService(createEffectActor(machine), Greeting, {
        value: 'spawned'
      })
    );
    await waitForEffects();

    const ref = actor.getSnapshot().context.ref;
    expect(ref?.getSnapshot().status).toBe('done');
    expect(ref?.getSnapshot().output).toBe('spawned');
  });

  it('routes a defect in an Effect action to onError', async () => {
    const defect = new Error('boom');
    let received: unknown;
    const machine = setupEffect({
      actions: {
        boom: (_args) => Effect.die(defect)
      }
    }).createMachine({
      initial: 'active',
      states: {
        active: {
          on: { BOOM: (args, enq) => enq(args.actions.boom, args) },
          onError: ({ event }) => {
            received = event.error;
            return { target: 'failed' };
          }
        },
        failed: {}
      }
    });

    const actor = await runScoped(createEffectActor(machine));
    actor.send({ type: 'BOOM' });
    await waitForEffects();

    expect(actor.getSnapshot().value).toBe('failed');
    expect(received).toBe(defect);
  });

  it('re-subscribes a restored Effect stream', async () => {
    let subscriptions = 0;
    const logic = fromEffectStream(
      Stream.concat(
        Stream.fromEffect(
          Effect.sync(() => {
            subscriptions++;
            return subscriptions;
          })
        ),
        Stream.never
      )
    );

    const actor = await runScoped(createEffectActor(logic));
    await waitForEffects();

    expect(subscriptions).toBe(1);
    expect(actor.getSnapshot().context).toBe(1);

    const persisted = actor.getPersistedSnapshot();
    actor.stop();

    const restored = await runScoped(
      createEffectActor(logic, { snapshot: persisted })
    );
    await waitForEffects();

    expect(subscriptions).toBe(2);
    expect(restored.getSnapshot().context).toBe(2);
    restored.stop();
  });

  it('tolerates stopping an actor before its scope closes', async () => {
    let released = 0;

    await expect(
      Effect.runPromise(
        Effect.scoped(
          Effect.gen(function* () {
            const actor = yield* createEffectActor(
              fromEffect(
                Effect.gen(function* () {
                  yield* Effect.addFinalizer(() =>
                    Effect.sync(() => {
                      released++;
                    })
                  );
                  return yield* Effect.never;
                })
              )
            );

            actor.stop();
            actor.stop();
            yield* Effect.promise(waitForEffects);

            expect(actor.getSnapshot().status).toBe('stopped');
          })
        )
      )
    ).resolves.toBeUndefined();

    expect(released).toBe(1);
  });

  it('runs hosted Effects inside a traced xstate.effect span', async () => {
    let spanName: string | undefined;
    let attributes: Record<string, unknown> | undefined;
    const worker = fromEffect(
      Effect.gen(function* () {
        const span = yield* Effect.currentSpan;
        spanName = span.name;
        attributes = Object.fromEntries(span.attributes);
        return 'ok';
      })
    );
    const machine = setup({ actors: { worker } }).createMachine({
      initial: 'pending',
      states: {
        pending: {
          invoke: { src: 'worker', id: 'worker', onDone: { target: 'done' } }
        },
        done: {}
      }
    });

    const actor = await runScoped(createEffectActor(machine, { id: 'traced' }));
    await waitForEffects();

    expect(actor.getSnapshot().value).toBe('done');
    expect(spanName).toBe('xstate.effect');
    expect(attributes).toEqual({
      'xstate.actor.id': 'worker',
      'xstate.actor.address': 'traced/worker'
    });
  });
});
