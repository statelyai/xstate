import { expect, it } from 'vitest';
import {
  createMachine,
  createStepLogic,
  stopActor,
  type AnyActorLogic
} from '../src/index.ts';
import {
  createDurable,
  type DurableExecutionAdapter
} from '../src/durable/index.ts';
import { deliverEvent } from '../src/runtimeHelpers.ts';

const worker = createMachine({
  initial: 'waiting',
  states: {
    waiting: { on: { WORK: { target: 'finished' } } },
    finished: { type: 'final' }
  }
});
const parent = createMachine({
  id: 'parent',
  actors: { worker },
  initial: 'working',
  states: {
    working: {
      invoke: { id: 'worker', src: 'worker', onDone: { target: 'success' } },
      on: {
        GO: ({ children }, enq) =>
          enq.sendTo(children.worker, { type: 'WORK' }),
        RESTART: { target: 'working', reenter: true },
        EXIT: { target: 'idle' }
      }
    },
    success: {},
    idle: {}
  }
});
function adapter(executionId?: string): DurableExecutionAdapter<AnyActorLogic> {
  return {
    executionId,
    executeAction: (action) => action.exec(),
    waitForEvent: () => ({ type: 'PING' }),
    spawnActor: () => {},
    startActor: (actor) => {
      actor.start();
    },
    stopActor,
    sendEvent: deliverEvent
  };
}
function roundTrip<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
async function completedChild(executionId?: string) {
  const execution = createDurable(parent, adapter(executionId));
  let [snapshot, effects] = execution.initialTransition();
  await execution.executeEffects(effects);
  [snapshot, effects] = execution.transition(snapshot, { type: 'GO' });
  await execution.executeEffects(effects);
  return { execution, snapshot };
}

it.each([undefined, 'pinned'])(
  'restores a child completion with executionId %s',
  async (executionId) => {
    const { execution, snapshot } = await completedChild(executionId);
    const pendingEvents = roundTrip(execution.getPendingEvents(snapshot));
    expect(pendingEvents[0].source).toEqual({ $actor: 'parent/worker' });
    expect((await execution.waitForEvent()).type).toBe('xstate.done.actor');
    const resumed = createDurable(parent, adapter(executionId));
    let [restored, effects] = resumed.restore(
      roundTrip(parent.getPersistedSnapshot(snapshot)),
      { pendingEvents }
    );
    await resumed.executeEffects(effects);
    const event = await resumed.waitForEvent();
    expect(event.type).toBe('xstate.done.actor');
    [restored] = resumed.transition(restored, event);
    expect(restored.value).toBe('success');
  }
);

it('restores generic raised events in FIFO order and keeps rich payloads by reference', async () => {
  const payload = new Date(0);
  const logic = createStepLogic({
    context: { count: 0 },
    run: ({ event, context }, enq) => {
      if (event.type === 'GO') {
        const first = { type: 'INC', by: 1, payload };
        const second = { type: 'INC', by: 10, payload: NaN };
        enq.raise(first);
        enq.raise(second);
      }
      if (event.type === 'INC' && 'by' in event && typeof event.by === 'number')
        return { context: { count: context.count + event.by } };
    }
  });
  const original = createDurable(logic, adapter());
  let [snapshot, effects] = original.initialTransition();
  await original.executeEffects(effects);
  [snapshot, effects] = original.transition(snapshot, { type: 'GO' });
  await original.executeEffects(effects);
  const pendingEvents = original.getPendingEvents(snapshot);
  expect(pendingEvents).toHaveLength(2);
  expect(pendingEvents[0].event.payload).toBe(payload);
  expect(pendingEvents[1].event.payload).toBeNaN();
  const saved = original.getActorRef(snapshot)!.getPersistedSnapshot();
  const resumed = createDurable(logic, adapter());
  let [restored, restoreEffects] = resumed.restore(saved, { pendingEvents });
  await resumed.executeEffects(restoreEffects);
  for (const [by, count] of [
    [1, 1],
    [10, 11]
  ]) {
    const event = await resumed.waitForEvent();
    expect(event).toMatchObject({ type: 'INC', by });
    [restored] = resumed.transition(restored, event);
    expect(restored.context.count).toBe(count);
  }
  expect((await resumed.waitForEvent()).type).toBe('PING');
});

it('keeps previous behavior when pending events are omitted', async () => {
  const { execution, snapshot } = await completedChild();
  expect(execution.getPendingEvents(snapshot)).toHaveLength(1);
  const resumed = createDurable(parent, adapter());
  const [, effects] = resumed.restore(
    roundTrip(parent.getPersistedSnapshot(snapshot))
  );
  await resumed.executeEffects(effects);
  expect((await resumed.waitForEvent()).type).toBe('PING');
});

it('validates pending events before allocating pinned identities', async () => {
  const original = createDurable(parent, adapter());
  const [snapshot] = original.initialTransition();
  const checkpoint = roundTrip(parent.getPersistedSnapshot(snapshot));
  const resumed = createDurable(parent, adapter('pinned'));
  expect(() =>
    resumed.restore(checkpoint, {
      // @ts-expect-error Exercise validation of untrusted host data.
      pendingEvents: [{ event: {} }]
    })
  ).toThrow('Invalid pendingEvents');
  const [retried] = resumed.restore(checkpoint);
  const fresh = createDurable(parent, adapter('pinned'));
  const [control] = fresh.restore(checkpoint);
  expect(retried.children.worker.sessionId).toBe(
    control.children.worker.sessionId
  );
});
it('drops a retired child completion while retaining a current completion', async () => {
  const { execution, snapshot } = await completedChild();
  expect(execution.getPendingEvents(snapshot)).toHaveLength(1);
  let [replacement, effects] = execution.transition(snapshot, {
    type: 'RESTART'
  });
  await execution.executeEffects(effects);
  expect(execution.getPendingEvents(replacement)).toEqual([]);
  [replacement, effects] = execution.transition(replacement, { type: 'GO' });
  await execution.executeEffects(effects);
  const pendingEvents = execution.getPendingEvents(replacement);
  expect(pendingEvents).toHaveLength(1);
  const resumed = createDurable(parent, adapter());
  let [restored, restoreEffects] = resumed.restore(
    roundTrip(parent.getPersistedSnapshot(replacement)),
    { pendingEvents: roundTrip(pendingEvents) }
  );
  await resumed.executeEffects(restoreEffects);
  [restored] = resumed.transition(restored, await resumed.waitForEvent());
  expect(restored.value).toBe('success');
});

it.each([
  [undefined, false],
  ['pinned', false],
  ['pinned', true]
] as const)(
  'drops exited child completions before reentry with executionId %s and proxy %s',
  async (executionId, proxied) => {
    const machine = createMachine({
      id: 'queue-parent',
      actors: { worker },
      initial: 'working',
      states: {
        working: {
          invoke: {
            id: 'worker',
            src: 'worker',
            onDone: { target: 'success' }
          },
          on: {
            GO: ({ children, self }, enq) => {
              enq.sendTo(self, { type: 'EXIT' });
              enq.sendTo(self, { type: 'ENTER' });
              enq.sendTo(children.worker, { type: 'WORK' });
            },
            WORK: ({ children }, enq) =>
              enq.sendTo(children.worker, { type: 'WORK' }),
            EXIT: { target: 'idle' }
          }
        },
        idle: { on: { ENTER: { target: 'working' } } },
        success: {}
      }
    });
    const root = proxied ? new Proxy(machine, {}) : machine;
    const original = createDurable(root, adapter(executionId));
    let [snapshot, effects] = original.initialTransition();
    await original.executeEffects(effects);
    [snapshot, effects] = original.transition(snapshot, { type: 'GO' });
    await original.executeEffects(effects);
    const previousEvents = roundTrip(original.getPendingEvents(snapshot));
    expect(previousEvents.map(({ event }) => event.type)).toEqual([
      'EXIT',
      'ENTER',
      'xstate.done.actor'
    ]);
    [snapshot, effects] = original.transition(
      snapshot,
      await original.waitForEvent()
    );
    await original.executeEffects(effects);
    expect(snapshot.value).toBe('idle');
    expect(
      original.getPendingEvents(snapshot).map(({ event }) => event.type)
    ).toEqual(['ENTER']);
    const resumed = createDurable(root, {
      ...adapter(executionId),
      transitionIndex: original.nextTransitionIndex
    });
    // Hosts may supply an older saved queue, so restore also checks the checkpoint.
    let [restored, restoreEffects] = resumed.restore(
      roundTrip(machine.getPersistedSnapshot(snapshot)),
      { pendingEvents: previousEvents.slice(1) }
    );
    await resumed.executeEffects(restoreEffects);
    [restored, restoreEffects] = resumed.transition(
      restored,
      await resumed.waitForEvent()
    );
    await resumed.executeEffects(restoreEffects);
    expect(restored.value).toBe('working');
    expect((await resumed.waitForEvent()).type).toBe('PING');
    [restored, restoreEffects] = resumed.transition(restored, { type: 'WORK' });
    await resumed.executeEffects(restoreEffects);
    [restored, restoreEffects] = resumed.transition(
      restored,
      await resumed.waitForEvent()
    );
    await resumed.executeEffects(restoreEffects);
    expect(restored.value).toBe('success');
  }
);

it('preserves lifecycle-named events for generic logic', async () => {
  const payload = { value: 1 };
  const logic = createStepLogic({
    context: {},
    run: ({ event }, enq) => {
      if (event.type === 'GO') {
        const reply = {
          type: 'xstate.done.actor',
          actorId: 'worker',
          sessionId: 'old',
          payload
        };
        enq.raise(reply);
      }
    }
  });
  const original = createDurable(logic, adapter());
  let [snapshot, effects] = original.initialTransition();
  await original.executeEffects(effects);
  [snapshot, effects] = original.transition(snapshot, { type: 'GO' });
  await original.executeEffects(effects);
  const pendingEvents = original.getPendingEvents(snapshot);
  expect(pendingEvents).toHaveLength(1);
  const resumed = createDurable(logic, adapter());
  const [, restoreEffects] = resumed.restore(
    original.getActorRef(snapshot)!.getPersistedSnapshot(),
    { pendingEvents }
  );
  await resumed.executeEffects(restoreEffects);
  expect(await resumed.waitForEvent()).toBe(pendingEvents[0].event);
  expect(pendingEvents[0].event.payload).toBe(payload);
});

it('does not duplicate saved snapshot notifications when a child restarts', async () => {
  const child = createMachine({
    context: { count: 0 },
    on: { BUMP: ({ context }) => ({ context: { count: context.count + 1 } }) }
  });
  const machine = createMachine({
    actors: { child },
    context: { seen: 0 },
    invoke: {
      id: 'child',
      src: 'child',
      onSnapshot: ({ context }) => ({ context: { seen: context.seen + 1 } })
    },
    on: {
      GO: ({ children }, enq) => enq.sendTo(children.child, { type: 'BUMP' })
    }
  });
  const original = createDurable(machine, adapter());
  let [snapshot, effects] = original.initialTransition();
  await original.executeEffects(effects);
  [snapshot, effects] = original.transition(snapshot, { type: 'GO' });
  await original.executeEffects(effects);
  const pendingEvents = original.getPendingEvents(snapshot);
  expect(pendingEvents.map(({ event }) => event)).toMatchObject([
    { type: 'xstate.snapshot.actor', snapshot: { context: { count: 0 } } },
    { type: 'xstate.snapshot.actor', snapshot: { context: { count: 1 } } }
  ]);
  const checkpoint = roundTrip(machine.getPersistedSnapshot(snapshot));
  let live = snapshot;
  for (const _ of pendingEvents) {
    [live, effects] = original.transition(live, await original.waitForEvent());
    await original.executeEffects(effects);
  }
  expect(live.context.seen).toBe(2);
  expect((await original.waitForEvent()).type).toBe('PING');
  const resumed = createDurable(machine, adapter());
  let [restored, restoreEffects] = resumed.restore(checkpoint, {
    pendingEvents: roundTrip(pendingEvents)
  });
  await resumed.executeEffects(restoreEffects);
  for (const _ of pendingEvents) {
    [restored, restoreEffects] = resumed.transition(
      restored,
      await resumed.waitForEvent()
    );
    await resumed.executeEffects(restoreEffects);
  }
  expect(restored.context.seen).toBe(live.context.seen);
  expect((await resumed.waitForEvent()).type).toBe('PING');
  [restored, restoreEffects] = resumed.transition(restored, { type: 'GO' });
  await resumed.executeEffects(restoreEffects);
  [restored, restoreEffects] = resumed.transition(
    restored,
    await resumed.waitForEvent()
  );
  await resumed.executeEffects(restoreEffects);
  expect(restored.context.seen).toBe(3);
  const legacy = createDurable(machine, adapter());
  let [legacyState, legacyEffects] = legacy.restore(checkpoint);
  await legacy.executeEffects(legacyEffects);
  [legacyState, legacyEffects] = legacy.transition(
    legacyState,
    await legacy.waitForEvent()
  );
  await legacy.executeEffects(legacyEffects);
  expect(legacyState.context.seen).toBe(1);
  expect((await legacy.waitForEvent()).type).toBe('PING');

  const changing = createDurable(machine, {
    ...adapter(),
    startActor: (actor) => {
      actor.start();
      actor.send({ type: 'BUMP' });
    }
  });
  let [changed, changingEffects] = changing.restore(checkpoint, {
    pendingEvents: roundTrip(pendingEvents)
  });
  await changing.executeEffects(changingEffects);
  const notifications = changing.getPendingEvents(changed);
  expect(notifications.map(({ event }) => event)).toMatchObject([
    { snapshot: { context: { count: 0 } } },
    { snapshot: { context: { count: 1 } } },
    { snapshot: { context: { count: 2 } } }
  ]);
  for (const _ of notifications) {
    [changed, changingEffects] = changing.transition(
      changed,
      await changing.waitForEvent()
    );
    await changing.executeEffects(changingEffects);
  }
  expect(changed.context.seen).toBe(3);
  expect((await changing.waitForEvent()).type).toBe('PING');
});
