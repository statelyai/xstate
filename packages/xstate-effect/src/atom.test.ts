import { Cause, Context, Effect, Layer } from 'effect';
import { AsyncResult, Atom, AtomRegistry } from 'effect/unstable/reactivity';
import { createMachine, setup } from 'xstate';
import { createActorAtoms } from './atom.ts';
import { fromEffect, setupEffect } from './index.ts';
import { NotReadyError } from './atom.ts';

const until = async (predicate: () => boolean, timeoutMs = 1000) => {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
};

const counterMachine = createMachine({
  context: { count: 0 },
  on: {
    INC: ({ context }) => ({ context: { count: context.count + 1 } })
  }
});

describe('createActorAtoms', () => {
  it('starts the actor on first read and exposes its snapshot', async () => {
    const registry = AtomRegistry.make();
    const runtime = Atom.runtime(Layer.empty);
    const atoms = createActorAtoms(runtime, counterMachine);

    const unmount = registry.mount(atoms.snapshot);
    await until(() => AsyncResult.isSuccess(registry.get(atoms.snapshot)));

    const snapshot = registry.get(atoms.snapshot);
    expect(AsyncResult.isSuccess(snapshot) && snapshot.value.context).toEqual({
      count: 0
    });
    unmount();
  });

  it('sends events through the send atom and updates the snapshot', async () => {
    const registry = AtomRegistry.make();
    const runtime = Atom.runtime(Layer.empty);
    const atoms = createActorAtoms(runtime, counterMachine);
    const counts: number[] = [];

    const unsubscribe = registry.subscribe(
      atoms.select((snapshot) => snapshot.context.count),
      (result) => {
        if (AsyncResult.isSuccess(result)) {
          counts.push(result.value);
        }
      },
      { immediate: true }
    );
    await until(() => counts.length > 0);

    registry.set(atoms.send, { type: 'INC' });
    registry.set(atoms.send, { type: 'INC' });
    await until(() => counts.at(-1) === 2);

    expect(counts).toEqual([0, 1, 2]);
    unsubscribe();
  });

  it('runs Effect logic with services from the runtime layer', async () => {
    class Greeting extends Context.Service<Greeting, { value: string }>()(
      'Greeting'
    ) {}
    const greet = fromEffect(
      Greeting.use((greeting) => Effect.succeed(greeting.value))
    );
    const machine = setup({ actors: { greet } }).createMachine({
      context: { greeting: '' },
      initial: 'loading',
      states: {
        loading: {
          invoke: {
            src: 'greet',
            onDone: {
              target: 'done',
              context: ({ event }) => ({ greeting: event.output })
            }
          }
        },
        done: {}
      }
    });
    const registry = AtomRegistry.make();
    const runtime = Atom.runtime(Layer.succeed(Greeting, { value: 'hello' }));
    const atoms = createActorAtoms(runtime, machine);

    const unmount = registry.mount(atoms.snapshot);
    await until(() => {
      const result = registry.get(atoms.snapshot);
      return AsyncResult.isSuccess(result) && result.value.value === 'done';
    });

    const result = registry.get(atoms.snapshot);
    expect(AsyncResult.isSuccess(result) && result.value.context).toEqual({
      greeting: 'hello'
    });
    unmount();
  });

  it('rejects a runtime that does not provide a required service', () => {
    class Greeting extends Context.Service<Greeting, { value: string }>()(
      'Greeting'
    ) {}
    const machine = setupEffect({
      actions: {
        greet: (_args) => Greeting.use(() => Effect.void)
      }
    }).createMachine({
      on: { GREET: (args, enq) => enq(args.actions.greet, args) }
    });
    const runtime = Atom.runtime(Layer.empty);

    const create = () => {
      // @ts-expect-error -- the runtime layer does not provide Greeting
      createActorAtoms(runtime, machine);
    };
    void create;
  });

  it('stops the actor when its atoms are released', async () => {
    const registry = AtomRegistry.make();
    const runtime = Atom.runtime(Layer.empty);
    const atoms = createActorAtoms(runtime, counterMachine);

    const unmount = registry.mount(atoms.snapshot);
    await until(() => AsyncResult.isSuccess(registry.get(atoms.actor)));
    const result = registry.get(atoms.actor);
    const actor = AsyncResult.isSuccess(result) ? result.value : undefined;
    expect(actor?.getSnapshot().status).toBe('active');

    unmount();
    await until(() => actor?.getSnapshot().status === 'stopped');

    expect(actor?.getSnapshot().status).toBe('stopped');
  });

  it('reports NotReadyError when an event is sent before the runtime is ready', async () => {
    class Slow extends Context.Service<Slow, { ready: true }>()('Slow') {}
    const registry = AtomRegistry.make();
    const runtime = Atom.runtime(
      Layer.effect(
        Slow,
        Effect.delay(Effect.succeed({ ready: true as const }), '5 millis')
      )
    );
    const atoms = createActorAtoms(runtime, counterMachine);

    const unmount = registry.mount(atoms.send);
    registry.set(atoms.send, { type: 'INC' });
    const early = registry.get(atoms.send);
    expect(AsyncResult.isFailure(early)).toBe(true);
    expect(
      AsyncResult.isFailure(early) && Cause.squash(early.cause)
    ).toBeInstanceOf(NotReadyError);

    await until(() => AsyncResult.isSuccess(registry.get(atoms.actor)));
    registry.set(atoms.send, { type: 'INC' });
    const late = registry.get(atoms.actor);
    await until(
      () =>
        AsyncResult.isSuccess(late) &&
        late.value.getSnapshot().context.count === 1
    );
    expect(
      AsyncResult.isSuccess(late) && late.value.getSnapshot().context
    ).toEqual({
      count: 1
    });
    expect(AsyncResult.isSuccess(registry.get(atoms.send))).toBe(true);
    unmount();
  });

  it('exposes an errored actor as a failed result', async () => {
    const failure = { code: 'BOOM' as const };
    const registry = AtomRegistry.make();
    const runtime = Atom.runtime(Layer.empty);
    const atoms = createActorAtoms(runtime, fromEffect(Effect.fail(failure)));

    const unmount = registry.mount(atoms.result);
    await until(() => AsyncResult.isFailure(registry.get(atoms.result)));

    const result = registry.get(atoms.result);
    expect(AsyncResult.isFailure(result) && Cause.squash(result.cause)).toEqual(
      failure
    );
    unmount();
  });
});
