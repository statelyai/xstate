import { Context, Duration, Effect, Exit, Scope, Stream } from 'effect';
import { TestClock } from 'effect/testing';
import {
  SimulatedClock,
  createMachine,
  setup,
  type Actor,
  type AnyActorRef
} from 'xstate';
import {
  EffectInterruptedError,
  createEffectActor,
  deadLetters,
  emitted,
  fromEffect,
  fromEffectStream,
  setupEffect
} from './index.ts';

// XState reports an unhandled actor error by rethrowing it from a
// `setTimeout(fn)` callback with no delay, which the test runner can only
// observe as an unhandled error. Intercepting exactly those calls makes "was
// this error reported?" an assertion instead. This works whether `xstate`
// resolves to source or to the built package, unlike mocking the module.
const reported: unknown[] = [];
const realSetTimeout = globalThis.setTimeout;

beforeAll(() => {
  vi.spyOn(globalThis, 'setTimeout').mockImplementation(((
    callback: (...args: unknown[]) => void,
    delay?: number,
    ...args: unknown[]
  ) => {
    if (delay !== undefined) {
      return realSetTimeout(callback, delay, ...args);
    }
    try {
      callback(...args);
    } catch (error) {
      reported.push(error);
    }
    return 0;
  }) as typeof setTimeout);
});

afterAll(() => {
  vi.restoreAllMocks();
});

/**
 * Polls until `predicate` holds. Effects run on detached fibers, so tests wait
 * for the condition they assert on instead of for a fixed number of ticks.
 */
const until = async (predicate: () => boolean, timeoutMs = 1000) => {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
};

let scopes: Scope.Closeable[] = [];

beforeEach(() => {
  reported.length = 0;
});

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
    let started = false;
    let interrupted = false;
    const logic = fromEffect(
      Effect.ensuring(
        Effect.sync(() => {
          started = true;
        }).pipe(Effect.andThen(Effect.never)),
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
          yield* Effect.promise(() => until(() => started));

          expect(actor.getSnapshot().status).toBe('active');
          expect(interrupted).toBe(false);
        })
      )
    );

    expect(actor.getSnapshot().status).toBe('stopped');
    expect(interrupted).toBe(true);
  });

  it('releases actor-scoped finalizers when the actor is stopped', async () => {
    let started = false;
    let released = 0;
    const logic = fromEffect(
      Effect.gen(function* () {
        yield* Effect.addFinalizer(() =>
          Effect.sync(() => {
            released++;
          })
        );
        started = true;
        return yield* Effect.never;
      })
    );
    const actor = await runScoped(createEffectActor(logic));
    await until(() => started);

    expect(released).toBe(0);

    actor.stop();
    await until(() => released === 1);

    expect(released).toBe(1);
  });

  it('releases actor-scoped finalizers when the enclosing scope closes', async () => {
    let started = false;
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
                started = true;
                return yield* Effect.never;
              })
            )
          );
          yield* Effect.promise(() => until(() => started));

          expect(released).toBe(0);
        })
      )
    );

    expect(released).toBe(1);
  });

  it('keeps actor-scoped finalizers open after the Effect itself completes', async () => {
    let completed = false;
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
            completed = true;
          })
      }
    }).createMachine({
      on: {
        WORK: (args, enq) => enq(args.actions.work, args)
      }
    });
    const actor = await runScoped(createEffectActor(machine));

    actor.send({ type: 'WORK' });
    await until(() => completed);

    expect(released).toBe(0);
    expect(actor.getSnapshot().status).toBe('active');

    actor.stop();
    await until(() => released === 1);

    expect(released).toBe(1);
  });

  it('runs a hosted finalizer before Effect.scoped resolves', async () => {
    const order: string[] = [];
    let started = false;

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* createEffectActor(
            fromEffect(
              Effect.gen(function* () {
                yield* Effect.addFinalizer(() =>
                  Effect.sync(() => {
                    order.push('finalizer');
                  })
                );
                started = true;
                return yield* Effect.never;
              })
            )
          );
          yield* Effect.promise(() => until(() => started));
        })
      )
    );
    order.push('scope closed');

    expect(order).toEqual(['finalizer', 'scope closed']);
  });

  it('runs a hosted finalizer when the actor errors', async () => {
    let released = 0;
    const logic = fromEffect(
      Effect.gen(function* () {
        yield* Effect.addFinalizer(() =>
          Effect.sync(() => {
            released++;
          })
        );
        return yield* Effect.fail({ code: 'BOOM' as const }).pipe(
          Effect.delay(1)
        );
      })
    );
    const actor = await runScoped(createEffectActor(logic));
    actor.subscribe({ error: () => {} });
    await until(() => actor.getSnapshot().status === 'error');
    await until(() => released === 1);

    expect(released).toBe(1);
  });

  it('tolerates stopping an actor before its scope closes', async () => {
    let started = false;
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
                  started = true;
                  return yield* Effect.never;
                })
              )
            );
            yield* Effect.promise(() => until(() => started));

            actor.stop();
            actor.stop();
            yield* Effect.promise(() => until(() => released === 1));

            expect(actor.getSnapshot().status).toBe('stopped');
          })
        )
      )
    ).resolves.toBeUndefined();

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

          expect(actor.getSnapshot().value).toBe('green');

          yield* TestClock.adjust('1 second');
          yield* Effect.promise(() =>
            until(() => actor.getSnapshot().value === 'yellow')
          );

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

  it('reads the current time from the Effect clock', async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const actor = yield* createEffectActor(createMachine({}));
          // `Clock.now` is optional in XState; the Effect clock always has it.
          const now = () => actor.clock.now?.();

          expect(now()).toBe(0);

          yield* TestClock.setTime(1000);
          expect(now()).toBe(1000);

          yield* TestClock.adjust(Duration.seconds(5));
          expect(now()).toBe(6000);
        })
      ).pipe(Effect.provide(TestClock.layer()))
    );
  });

  it('interrupts a pending after timer when the enclosing scope closes', async () => {
    let entered = 0;
    const machine = createMachine({
      initial: 'green',
      states: {
        green: { after: { 1000: { target: 'yellow' } } },
        yellow: {
          entry: () => {
            entered++;
          }
        }
      }
    });

    await Effect.runPromise(
      Effect.gen(function* () {
        yield* Effect.scoped(
          Effect.gen(function* () {
            yield* createEffectActor(machine);
            yield* TestClock.adjust('500 millis');
          })
        );

        // The timer fiber lived in the actor scope, which is now closed.
        yield* TestClock.adjust('5 seconds');

        expect(entered).toBe(0);
      }).pipe(Effect.provide(TestClock.layer()))
    );
  });

  it('reports a root actor error that no subscriber observed', async () => {
    const failure = { code: 'UNOBSERVED' as const };
    const actor = await runScoped(
      createEffectActor(fromEffect(Effect.fail(failure).pipe(Effect.delay(1))))
    );
    await until(() => actor.getSnapshot().status === 'error');
    await until(() => reported.length > 0);

    expect(reported).toEqual([failure]);
  });

  it('does not report a root actor error observed by a subscriber', async () => {
    const failure = { code: 'OBSERVED' as const };
    const observed: unknown[] = [];
    const actor = await runScoped(
      createEffectActor(fromEffect(Effect.fail(failure).pipe(Effect.delay(1))))
    );
    actor.subscribe({ error: (error) => observed.push(error) });
    await until(() => actor.getSnapshot().status === 'error');

    expect(observed).toEqual([failure]);
    expect(reported).toEqual([]);
  });

  it('reports self-interruption as an EffectInterruptedError', async () => {
    const actor = await runScoped(
      createEffectActor(fromEffect(Effect.interrupt))
    );
    await until(() => actor.getSnapshot().status === 'error');

    const snapshot = actor.getSnapshot();
    const error: unknown = snapshot.error;
    expect(error).toBeInstanceOf(EffectInterruptedError);
    expect((error as EffectInterruptedError)._tag).toBe(
      'EffectInterruptedError'
    );
  });

  it('reports an Effect.timeout as a TimeoutError failure', async () => {
    const logic = fromEffect(Effect.timeout(Effect.never, Duration.millis(1)));
    const actor = await runScoped(createEffectActor(logic));
    actor.subscribe({ error: () => {} });
    await until(() => actor.getSnapshot().status === 'error');

    const error: unknown = actor.getSnapshot().error;
    expect((error as { _tag?: string })._tag).toBe('TimeoutError');
    expect(error).not.toBeInstanceOf(EffectInterruptedError);
  });

  it('reports a defect from Effect.die as the actor error', async () => {
    const defect = new Error('defect');
    const actor = await runScoped(
      createEffectActor(fromEffect(Effect.die(defect)))
    );
    await until(() => actor.getSnapshot().status === 'error');

    expect(actor.getSnapshot().status).toBe('error');
    expect(actor.getSnapshot().error).toBe(defect);
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
    await until(() => actor.getSnapshot().value === 'failed');

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
    await until(() => interrupted);

    expect(actor.getSnapshot().value).toBe('cancelled');
    expect(actor.getSnapshot().status).toBe('active');
    expect(child?.getSnapshot().status).toBe('stopped');
    expect(child?.getSnapshot().error).toBeUndefined();
    expect(reported).toEqual([]);
  });

  it('interrupts a running Effect action when its actor is stopped', async () => {
    let started = false;
    let interrupted = false;
    const machine = setupEffect({
      actions: {
        work: (_args) =>
          Effect.ensuring(
            Effect.sync(() => {
              started = true;
            }).pipe(Effect.andThen(Effect.never)),
            Effect.sync(() => {
              interrupted = true;
            })
          )
      }
    }).createMachine({
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
    await until(() => started);
    actor.stop();
    await until(() => interrupted);

    expect(interrupted).toBe(true);
  });

  it('does not block the actor while an Effect action runs', async () => {
    let started = false;
    let finished = false;
    const machine = setupEffect({
      actions: {
        work: (_args) =>
          Effect.gen(function* () {
            started = true;
            yield* Effect.never;
            finished = true;
          })
      }
    }).createMachine({
      context: { count: 0 },
      on: {
        WORK: (args, enq) => enq(args.actions.work, args),
        PING: ({ context }) => ({ context: { count: context.count + 1 } })
      }
    });
    const actor = await runScoped(createEffectActor(machine));

    actor.send({ type: 'WORK' });
    await until(() => started);
    actor.send({ type: 'PING' });

    expect(actor.getSnapshot().context).toEqual({ count: 1 });
    expect(finished).toBe(false);
  });

  // Known gap: `setupEffect` wraps the actions declared in `setup` and
  // `extend`, but `machine.provide` merges raw sources, so an Effect returned
  // by a provided action is created and discarded. Overriding with a plain
  // core action does work; see the test below.
  it('runs an Effect action provided through machine.provide in the host context', async () => {
    const Audit = Context.Service<{ record: (value: string) => void }>('Audit');
    const recorded: string[] = [];
    const machine = setupEffect({
      actions: {
        audit: (_args) =>
          Audit.use((audit) => Effect.sync(() => audit.record('declared')))
      }
    }).createMachine({
      on: {
        AUDIT: (args, enq) => enq(args.actions.audit, args)
      }
    });
    const provided = machine.provide({
      actions: {
        audit: (_args: unknown) =>
          Audit.use((audit) => Effect.sync(() => audit.record('provided')))
      }
    });

    const actor = await runScoped(
      Effect.provideService(createEffectActor(provided), Audit, {
        record: (value) => recorded.push(value)
      })
    );
    actor.send({ type: 'AUDIT' });
    await until(() => recorded.length > 0, 50);

    expect(recorded).toEqual(['provided']);
  });

  it('runs a plain action provided through machine.provide', async () => {
    const recorded: string[] = [];
    const machine = setupEffect({
      actions: {
        audit: (_args) => Effect.sync(() => recorded.push('declared'))
      }
    }).createMachine({
      on: {
        AUDIT: (args, enq) => enq(args.actions.audit, args)
      }
    });
    const provided = machine.provide({
      actions: {
        audit: () => {
          recorded.push('provided');
        }
      }
    });

    const actor = await runScoped(createEffectActor(provided));
    actor.send({ type: 'AUDIT' });
    await until(() => recorded.length > 0);

    expect(recorded).toEqual(['provided']);
  });

  it('observes events emitted from the fromEffect source args', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const logic = fromEffect(({ emit }) =>
      Effect.gen(function* () {
        yield* Effect.promise(() => gate);
        emit({ type: 'progress', value: 1 });
        emit({ type: 'progress', value: 2 });
        return 'done';
      })
    );

    const collected: unknown[] = [];

    await runScoped(
      Effect.gen(function* () {
        const actor = yield* createEffectActor(logic);
        let listeners = 0;
        const actorOn = actor.on.bind(actor);
        actor.on = ((...args: Parameters<typeof actorOn>) => {
          listeners++;
          return actorOn(...args);
        }) as typeof actor.on;

        yield* Effect.forkScoped(
          Stream.runForEach(emitted(actor), (event) =>
            Effect.sync(() => {
              collected.push(event);
            })
          )
        );
        yield* Effect.promise(() => until(() => listeners > 0));
        release();
        yield* Effect.promise(() => until(() => collected.length === 2));
      })
    );

    expect(collected).toEqual([
      { type: 'progress', value: 1 },
      { type: 'progress', value: 2 }
    ]);
  });

  it('reports a failing Effect stream as an actor error', async () => {
    const failure = { code: 'STREAM_FAILED' as const };
    const actor = await runScoped(
      createEffectActor(fromEffectStream(Stream.fail(failure)))
    );
    await until(() => actor.getSnapshot().status === 'error');

    expect(actor.getSnapshot().error).toEqual(failure);
    expect(reported).toEqual([failure]);
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
    await until(() => interrupted);

    expect(actor.getSnapshot().value).toBe('cancelled');
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
    await until(() => actor.getSnapshot().status === 'done');

    expect(actor.getSnapshot().output).toBe('winner');
    expect(actor.getSnapshot().error).toBeUndefined();
    expect(loserReleased).toBe(true);
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
    await until(() => actor.getSnapshot().value === 'done');

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
    const ref = actor.getSnapshot().context.ref!;
    await until(() => ref.getSnapshot().status === 'done');

    expect(ref.getSnapshot().output).toBe('spawned');
  });

  it('rejects inline Effect logic passed to enq.spawn', async () => {
    const machine = setup({}).createMachine({
      context: { ref: undefined as AnyActorRef | undefined },
      entry: (_args, enq) => ({
        context: { ref: enq.spawn(fromEffect(Effect.succeed('inline'))) }
      })
    });

    const actor = await runScoped(createEffectActor(machine));
    const ref = actor.getSnapshot().context.ref!;
    await until(() => ref.getSnapshot().status === 'error');

    expect(String(ref.getSnapshot().error)).toMatch(
      /must be declared in setup\(\{ actors \}\)/
    );
  });

  it('rejects inline spawned logic even when another invoke has a dynamic src', async () => {
    const leaf = fromEffect(Effect.succeed('leaf'));
    const machine = setup({ actors: { leaf } }).createMachine({
      context: {
        declared: undefined as AnyActorRef | undefined,
        inline: undefined as AnyActorRef | undefined
      },
      initial: 'working',
      states: {
        working: {
          invoke: {
            src: ({ actors }) => actors.leaf,
            id: 'dynamic',
            onDone: { target: 'done' }
          },
          entry: ({ actors }, enq) => ({
            context: {
              declared: enq.spawn(actors.leaf),
              inline: enq.spawn(fromEffect(Effect.succeed('inline')))
            }
          })
        },
        done: {}
      }
    });

    const actor = await runScoped(createEffectActor(machine));
    const { declared, inline } = actor.getSnapshot().context;
    await until(() => declared!.getSnapshot().status === 'done');
    await until(() => inline!.getSnapshot().status === 'error');
    await until(() => actor.getSnapshot().value === 'done');

    // A declared actor spawned by name is allowed…
    expect(declared!.getSnapshot().output).toBe('leaf');
    // …an inline one is not, even though a dynamic `invoke.src` is nearby…
    expect(String(inline!.getSnapshot().error)).toMatch(
      /must be declared in setup\(\{ actors \}\)/
    );
    // …and the dynamically invoked child still ran.
    expect(actor.getSnapshot().value).toBe('done');
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
    await until(() => actor.getSnapshot().value === 'failed');

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
    await until(() => actor.getSnapshot().context === 1);

    expect(subscriptions).toBe(1);

    const persisted = actor.getPersistedSnapshot();
    actor.stop();

    const restored = await runScoped(
      createEffectActor(logic, { snapshot: persisted })
    );
    await until(() => restored.getSnapshot().context === 2);

    expect(subscriptions).toBe(2);
    restored.stop();
  });

  it('reports a send to a stopped actor as a dead letter', async () => {
    const worker = fromEffect(Effect.never);
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
    const letters: Array<{ reason: string; type: string }> = [];

    await runScoped(
      Effect.gen(function* () {
        const actor = yield* createEffectActor(machine);
        const system = actor.system;
        const systemInspect = system.inspect.bind(system);
        let inspecting = false;
        system.inspect = ((observer: Parameters<typeof systemInspect>[0]) => {
          inspecting = true;
          return systemInspect(observer);
        }) as typeof system.inspect;

        yield* Effect.forkScoped(
          Stream.runForEach(deadLetters(actor), (event) =>
            Effect.sync(() => {
              letters.push({
                reason: event.reason,
                type: event.event.type
              });
            })
          )
        );
        yield* Effect.promise(() => until(() => inspecting));

        const child = actor.getSnapshot().children.worker!;
        actor.send({ type: 'CANCEL' });
        yield* Effect.promise(() =>
          until(() => child.getSnapshot().status === 'stopped')
        );

        child.send({ type: 'TO_CHILD' });
        actor.stop();
        actor.send({ type: 'TO_ROOT' });

        yield* Effect.promise(() => until(() => letters.length === 2));
      })
    );

    expect(letters).toEqual([
      { reason: 'stopped', type: 'TO_CHILD' },
      { reason: 'stopped', type: 'TO_ROOT' }
    ]);
  });

  it('accepts a fromEffect config without schemas', async () => {
    const logic = fromEffect({
      id: 'loadUser',
      effect: ({ input }: { input: { id: string } }) =>
        Effect.succeed({ greeting: `Hello ${input.id}` })
    });

    // `EffectActorLogic` does not surface the `id` that `createLogic` sets.
    expect(logic.id).toBe('loadUser');

    const actor = await runScoped(
      createEffectActor(logic, { input: { id: '42' } })
    );
    await until(() => actor.getSnapshot().status === 'done');

    actor.getSnapshot().output satisfies { greeting: string } | undefined;
    expect(actor.getSnapshot().output).toEqual({ greeting: 'Hello 42' });
  });

  it('runs hosted Effects inside spans named after their source', async () => {
    const spans: Array<{ name: string; attributes: Record<string, unknown> }> =
      [];
    const record = Effect.gen(function* () {
      const span = yield* Effect.currentSpan;
      spans.push({
        name: span.name,
        attributes: Object.fromEntries(span.attributes)
      });
    });
    const worker = fromEffect(Effect.as(record, 'ok'));
    const machine = setupEffect({
      actors: { worker },
      actions: { audit: (_args) => record }
    }).createMachine({
      initial: 'pending',
      on: { AUDIT: (args, enq) => enq(args.actions.audit, args) },
      states: {
        pending: {
          invoke: { src: 'worker', id: 'worker', onDone: { target: 'done' } }
        },
        done: {}
      }
    });

    const actor = await runScoped(createEffectActor(machine, { id: 'traced' }));
    await until(() => actor.getSnapshot().value === 'done');
    actor.send({ type: 'AUDIT' });
    await until(() => spans.length === 2);

    expect(spans[0]).toEqual({
      name: 'fromEffect',
      attributes: {
        'xstate.actor.id': 'worker',
        'xstate.actor.address': 'traced/worker'
      }
    });
    expect(spans[1]).toEqual({
      name: 'action.audit',
      attributes: {
        'xstate.actor.id': 'traced',
        'xstate.actor.address': 'traced'
      }
    });
  });
});
