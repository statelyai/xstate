import { vi } from 'vitest';
import { Cause, Effect, Exit, Scope } from 'effect';
import { type AnyActorRef, createCallbackLogic, setup, types } from 'xstate';
import {
  ActorStoppedError,
  createEffectActor,
  createEffectLogic,
  setupEffect,
  withActorScope
} from './index.ts';
import { sendAndAwait } from './test.ts';

const gate = vi.hoisted(() => {
  const state = {
    reached: Promise.resolve(),
    reach: () => {},
    release: () => {},
    wait: Promise.resolve()
  };
  return {
    state,
    reset() {
      state.reached = new Promise<void>((resolve) => {
        state.reach = resolve;
      });
      state.wait = new Promise<void>((resolve) => {
        state.release = resolve;
      });
    }
  };
});

vi.mock(import('xstate/durable'), async (importOriginal) => {
  const durable = await importOriginal();
  return {
    ...durable,
    createDurable: ((logic, adapter, options) =>
      durable.createDurable(
        logic,
        {
          ...adapter,
          startActor: async (child) => {
            if (child.id === 'slow') {
              gate.state.reach();
              await gate.state.wait;
            }
            await adapter.startActor?.(child);
          }
        },
        options
      )) as typeof durable.createDurable
  };
});

let trace: string[] = [];
let held = false;

beforeEach(() => {
  trace = [];
  held = false;
  gate.reset();
});

const open = async <A>(acquire: Effect.Effect<A, never, Scope.Scope>) => {
  const scope = await Effect.runPromise(Scope.make());
  const actor = await Effect.runPromise(Scope.provide(acquire, scope));
  return { actor, scope };
};

const close = (scope: Scope.Closeable) =>
  Effect.runPromise(Scope.close(scope, Exit.void));

const observe = (actor: AnyActorRef, name: string, onNext?: () => void) =>
  actor.subscribe({
    next: () => {
      trace.push(`${name} next`);
      onNext?.();
    },
    complete: () => {
      trace.push(`${name} complete`);
    }
  });

const isStopped = (exit: Exit.Exit<unknown, unknown>) =>
  Exit.isFailure(exit) && Cause.squash(exit.cause) instanceof ActorStoppedError;

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** GO emits `going`, then starts the child `slow`, whose start waits on the gate. */
const gated = setup({
  schemas: { events: { GO: types<{}>() }, emitted: { going: types<{}>() } },
  actors: { slow: createCallbackLogic(() => {}) }
}).createMachine({
  initial: 'idle',
  states: {
    idle: {
      on: {
        GO: (_args, enq) => {
          enq.emit({ type: 'going' });
          return { target: 'working' };
        }
      }
    },
    working: { invoke: { src: 'slow', id: 'slow' } }
  }
});

const pinging = setup({
  schemas: {
    events: { PING: types<{}>(), FINISH: types<{}>() },
    emitted: { first: types<{}>(), second: types<{}>() }
  }
}).createMachine({
  initial: 'active',
  states: {
    active: {
      on: {
        PING: (_args, enq) => {
          enq.emit({ type: 'first' });
          enq.emit({ type: 'second' });
        },
        FINISH: { target: 'done' }
      }
    },
    done: { type: 'final' }
  }
});

it('stops at once when an external caller stops it during a pending runtime operation', async () => {
  const { actor, scope } = await open(createEffectActor(gated));
  actor.on('going', () => trace.push('emit going'));
  observe(actor, 'observer');
  const receipt = Effect.runPromiseExit(sendAndAwait(actor, { type: 'GO' }));
  await gate.state.reached;

  actor.stop();

  expect(actor.getSnapshot().status).toBe('stopped');
  expect(trace).toEqual(['emit going', 'observer complete']);
  expect(isStopped(await receipt)).toBe(true);
  await close(scope);
  gate.state.release();
});

it('emits nothing after a stop that comes between two emitted events', async () => {
  const { actor, scope } = await open(createEffectActor(pinging));
  actor.on('first', () => queueMicrotask(() => actor.stop()));
  actor.on('*', (event) => trace.push(`emit ${event.type}`));
  observe(actor, 'observer');

  await Effect.runPromiseExit(sendAndAwait(actor, { type: 'PING' }));
  await flush();

  expect(trace).toEqual(['emit first', 'observer complete']);
  await close(scope);
});

it('delivers an event that an Effect emits outside a step to every listener when the first one stops the actor', async () => {
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  const logic = createEffectLogic(({ emit }) =>
    Effect.gen(function* () {
      yield* Effect.promise(() => released);
      emit({ type: 'progress' });
    })
  );
  const { actor, scope } = await open(createEffectActor(logic));
  actor.on('progress', () => {
    trace.push('first progress');
    actor.stop();
  });
  actor.on('progress', () => trace.push('second progress'));
  await flush();

  release();
  await vi.waitFor(() => expect(actor.getSnapshot().status).toBe('stopped'));

  expect(trace).toEqual(['first progress', 'second progress']);
  await close(scope);
});

it('gives every observer next before a stop from one of them completes the actor', async () => {
  const { actor, scope } = await open(createEffectActor(pinging));
  observe(actor, 'first', () => actor.stop());
  observe(actor, 'second');

  await Effect.runPromiseExit(sendAndAwait(actor, { type: 'PING' }));

  expect(trace).toEqual([
    'first next',
    'second next',
    'first complete',
    'second complete'
  ]);
  await close(scope);
});

it('gives every observer the final snapshot before a stop from one of them releases the actor', async () => {
  const holding = setupEffect({
    schemas: { events: { FINISH: types<{}>() } },
    actions: {
      hold: (_args: { self: AnyActorRef }) =>
        Effect.acquireRelease(
          Effect.sync(() => {
            held = true;
          }),
          () => Effect.sync(() => trace.push('released'))
        ).pipe(withActorScope)
    }
  }).createMachine({
    entry: (args, enq) => enq(args.actions.hold, args),
    initial: 'active',
    states: {
      active: { on: { FINISH: { target: 'done' } } },
      done: { type: 'final' }
    }
  });
  const { actor, scope } = await open(createEffectActor(holding));
  observe(actor, 'first', () => actor.stop());
  observe(actor, 'second');
  await vi.waitFor(() => expect(held).toBe(true));

  actor.send({ type: 'FINISH' });
  await vi.waitFor(() => expect(trace).toContain('released'));

  expect(trace).toEqual([
    'first next',
    'second next',
    'first complete',
    'second complete',
    'released'
  ]);
  await close(scope);
});

it('resolves the final receipt when an observer closes the scope on the final snapshot', async () => {
  const { actor, scope } = await open(createEffectActor(pinging));
  observe(actor, 'observer', () => {
    if (actor.getSnapshot().status === 'done') {
      Effect.runFork(Scope.close(scope, Exit.void));
    }
  });

  const snapshot = await Effect.runPromise(
    sendAndAwait(actor, { type: 'FINISH' })
  );

  expect(snapshot.status).toBe('done');
});
