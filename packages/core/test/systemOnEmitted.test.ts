import { NEVER } from 'rxjs';
import {
  createActor,
  createAsyncLogic,
  createCallbackLogic,
  createMachine,
  createObservableLogic,
  createSystem,
  executeEffects,
  transition,
  type ActorEmission,
  type ActorLogic,
  type AnyActor,
  type EventObject,
  type Snapshot
} from '../src/index.ts';
import { createDurable } from '../src/durable/index.ts';
import { createSnapshotSystem } from '../src/snapshotActorRef.ts';

const reported: unknown[] = [];

vi.mock('../src/reportUnhandledError.ts', () => ({
  reportUnhandledError: (error: unknown) => reported.push(error)
}));

const emitted = { type: 'tracked' };
const emittingMachine = createMachine({
  entry: (_, enq) => enq.emit(emitted),
  on: { EMIT: (_, enq) => enq.emit(emitted) }
});

beforeEach(() => {
  reported.length = 0;
});

it('observes root and descendant publications while actor.on remains local', () => {
  const emissions: ActorEmission[] = [];
  const rootEvents: EventObject[] = [];
  const system = createSystem({
    onEmitted: (emission) => emissions.push(emission)
  });
  const machine = createMachine({
    entry: (_, enq) => enq.emit(emitted),
    invoke: { id: 'child', src: emittingMachine }
  });
  const root = system.createActor(machine);
  root.on('tracked', (event) => rootEvents.push(event));
  root.start();

  const child = root.getSnapshot().children.child;
  expect(emissions).toHaveLength(2);
  expect(emissions.map(({ actorRef }) => actorRef)).toEqual([root, child]);
  expect(emissions.every(({ event }) => event === emitted)).toBe(true);
  expect(rootEvents).toEqual([emitted]);
  root.stop();
});

it('keeps contextual invocation IDs when shared logic enters different app states', () => {
  const ids: string[] = [];
  const system = createSystem({
    onEmitted: ({ actorRef }) => ids.push(actorRef.id)
  });
  const root = system
    .createActor(
      createMachine({
        initial: 'loading',
        states: {
          loading: {
            invoke: { id: 'app.loading', src: emittingMachine },
            on: { NEXT: { target: 'validation' } }
          },
          validation: { invoke: { id: 'app.validation', src: emittingMachine } }
        }
      })
    )
    .start();
  root.send({ type: 'NEXT' });
  expect(ids).toEqual(['app.loading', 'app.validation']);
  root.stop();
});

it('attaches config and pending listeners before constructor-time emissions, once', () => {
  const calls: string[] = [];
  const logic: ActorLogic<Snapshot<undefined>, EventObject> = {
    initialTransition: (_, scope) => {
      scope.emit(emitted);
      return [{ status: 'active', output: undefined, error: undefined }, []];
    },
    getInitialSnapshot: () => ({
      status: 'active',
      output: undefined,
      error: undefined
    }),
    transition: (snapshot) => [snapshot, []],
    getPersistedSnapshot: (snapshot) => snapshot
  };
  const system = createSystem({ onEmitted: () => calls.push('config') });
  system.onEmitted(() => calls.push('pending'));
  const canceled = system.onEmitted(() => calls.push('canceled'));
  canceled.unsubscribe();
  system.createActor(logic);
  system.createActor(logic);
  expect(calls).toEqual(['config', 'pending', 'config', 'pending']);
});

it('shares observation across builder roots and isolates unrelated systems', () => {
  const observed: AnyActor[] = [];
  const system = createSystem();
  const subscription = system.onEmitted(({ actorRef }) =>
    observed.push(actorRef)
  );
  const first = system.createActor(emittingMachine).start();
  const second = system.createActor(emittingMachine).start();
  const unrelated = createSystem().createActor(emittingMachine).start();
  const standalone = createActor(emittingMachine).start();
  expect(observed).toEqual([first, second]);
  subscription.unsubscribe();
  subscription.unsubscribe();
  first.send({ type: 'EMIT' });
  expect(observed).toEqual([first, second]);
  for (const actor of [first, second, unrelated, standalone]) actor.stop();
});

it('gives duplicate callback registrations independent subscriptions', () => {
  const listener = vi.fn();
  const system = createSystem();
  const first = system.onEmitted(listener);
  const second = system.onEmitted(listener);
  const actor = system.createActor(emittingMachine).start();
  expect(listener).toHaveBeenCalledTimes(2);
  first.unsubscribe();
  actor.send({ type: 'EMIT' });
  expect(listener).toHaveBeenCalledTimes(3);
  second.unsubscribe();
  actor.send({ type: 'EMIT' });
  expect(listener).toHaveBeenCalledTimes(3);
  actor.stop();
});

it('snapshots listeners during publication and observes later registrations next time', () => {
  const calls: string[] = [];
  const system = createSystem();
  const first = system.onEmitted(() => {
    calls.push('first');
    first.unsubscribe();
    second.unsubscribe();
    system.onEmitted(() => calls.push('late'));
  });
  const second = system.onEmitted(() => calls.push('second'));
  const actor = system.createActor(emittingMachine).start();
  expect(calls).toEqual(['first', 'second']);
  actor.send({ type: 'EMIT' });
  expect(calls).toEqual(['first', 'second', 'late']);
  actor.stop();
});

it('reports observer failures without suppressing other observers or local listeners', () => {
  const calls: string[] = [];
  const error = new Error('observer failed');
  const system = createSystem({
    onEmitted: () => {
      throw error;
    }
  });
  const actor = system.createActor(emittingMachine);
  actor.system.onEmitted(() => calls.push('system'));
  actor.on('tracked', () => calls.push('local'));
  actor.start();
  expect(reported).toEqual([error]);
  expect(calls).toEqual(['system', 'local']);
  expect(actor.getSnapshot().status).toBe('active');
  actor.stop();
});

it('observes callback, async and observable descendants from the root system', async () => {
  const emissions: ActorEmission[] = [];
  const system = createSystem({ onEmitted: (value) => emissions.push(value) });
  const root = system
    .createActor(
      createMachine({
        invoke: [
          {
            id: 'callback',
            src: createCallbackLogic(({ emit }) => emit(emitted))
          },
          {
            id: 'async',
            src: createAsyncLogic({
              run: async (_, enq) => {
                enq.emit(emitted);
              }
            })
          },
          {
            id: 'observable',
            src: createObservableLogic(({ emit }) => {
              emit(emitted);
              return NEVER;
            })
          }
        ]
      })
    )
    .start();
  await Promise.resolve();
  expect(emissions.map(({ actorRef }) => actorRef.id).sort()).toEqual([
    'async',
    'callback',
    'observable'
  ]);
  expect(emissions.every(({ event }) => event === emitted)).toBe(true);
  root.stop();
});

it('stores first subscriptions through nested snapshot views on the canonical system', () => {
  const system = createSystem();
  const root = system.createActor(emittingMachine);
  const view = createSnapshotSystem(createSnapshotSystem(root.system, {}), {});
  const calls: string[] = [];
  const subscription = view.onEmitted(() => calls.push('view'));
  system.onEmitted(() => calls.push('builder'));
  root.start();
  expect(calls).toEqual(['view', 'builder']);
  view._notifyEmitted(root, emitted);
  expect(calls).toEqual(['view', 'builder', 'view', 'builder']);
  subscription.unsubscribe();
  root.send({ type: 'EMIT' });
  expect(calls).toEqual(['view', 'builder', 'view', 'builder', 'builder']);
  root.stop();
});

it('keeps machine planning silent and observes executed effects through custom runtimes', async () => {
  const listener = vi.fn();
  const system = createSystem({ onEmitted: listener });
  const actor = system.createActor(emittingMachine);
  const [, effects] = transition(emittingMachine, actor.getSnapshot(), {
    type: 'EMIT'
  });
  expect(listener).not.toHaveBeenCalled();
  const dispatched = vi.fn();
  await executeEffects(effects, { emitEvent: dispatched });
  expect(listener).toHaveBeenCalledOnce();
  expect(dispatched).toHaveBeenCalledOnce();
  expect(listener.mock.calls[0][0]).toEqual({
    actorRef: dispatched.mock.calls[0][0],
    event: emitted
  });
});

it('observes before runtime override dispatch and preserves its returned promise', () => {
  const calls: string[] = [];
  const failure = new Error('observer failed');
  const system = createSystem({
    onEmitted: () => {
      calls.push('observe');
      throw failure;
    }
  });
  const actor = system.createActor(emittingMachine);
  const completion = Promise.resolve();
  actor.system.runtime = {
    emitEvent: () => {
      calls.push('dispatch');
      return completion;
    }
  };
  const [, effects] = transition(emittingMachine, actor.getSnapshot(), {
    type: 'EMIT'
  });
  const effect = effects.find((item) => item.kind === 'emit');
  expect(effect).toBeDefined();
  expect(effect?.exec()).toBe(completion);
  expect(calls).toEqual(['observe', 'dispatch']);
  expect(reported).toEqual([failure]);
});

it('keeps low-level runtime emitEvent dispatch separate from actor publication', () => {
  const actor = createActor(emittingMachine);
  const listener = vi.fn();
  const local = vi.fn();
  actor.system.onEmitted(listener);
  actor.on('tracked', local);
  actor.system.emitEvent(actor, emitted);
  expect(listener).not.toHaveBeenCalled();
  expect(local).toHaveBeenCalledWith(emitted);
  actor.start();
  expect(listener).toHaveBeenCalledOnce();
  expect(local).toHaveBeenCalledTimes(2);
  actor.stop();
});

it.each(['adapter', 'per-effect', 'fallback'] as const)(
  'observes durable %s dispatch exactly once',
  async (mode) => {
    const observe = vi.fn();
    const dispatch = vi.fn();
    const durable = createDurable(emittingMachine, {
      ...(mode === 'adapter' ? { emitEvent: dispatch } : {}),
      runtime: () => (mode === 'per-effect' ? { emitEvent: dispatch } : {}),
      executeAction: () => {},
      waitForEvent: () => ({ type: 'EMIT' })
    });
    const [, effects] = durable.initialTransition();
    const emissionEffect = effects.find(
      ({ effect }) => effect.kind === 'emit'
    )?.effect;
    if (emissionEffect?.kind !== 'emit')
      throw new Error('Missing emission effect');
    emissionEffect.source.system.onEmitted(observe);
    expect(observe).not.toHaveBeenCalled();
    await durable.executeEffects(effects);
    expect(observe).toHaveBeenCalledExactlyOnceWith({
      actorRef: emissionEffect.source,
      event: emitted
    });
    expect(dispatch).toHaveBeenCalledTimes(mode === 'fallback' ? 0 : 1);
  }
);

it.each(['async', 'observable'] as const)(
  'observes %s effect emissions through an explicit runtime',
  async (kind) => {
    const logic =
      kind === 'async'
        ? createAsyncLogic({
            run: async (_, enq) => {
              enq.emit(emitted);
            }
          })
        : createObservableLogic(({ emit }) => {
            emit(emitted);
            return NEVER;
          });
    const actor = createActor(logic);
    const observe = vi.fn();
    const dispatch = vi.fn();
    actor.system.onEmitted(observe);
    const [, effects] = transition(logic, actor.getSnapshot(), {
      type: 'xstate.init'
    });
    await executeEffects(effects, { emitEvent: dispatch, sendEvent: () => {} });
    expect(observe).toHaveBeenCalledOnce();
    expect(dispatch).toHaveBeenCalledOnce();
  }
);
