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
        const first = { type: 'INC', payload };
        const second = { type: 'INC', payload: NaN };
        enq.raise(first);
        enq.raise(second);
      }
      if (event.type === 'INC')
        return { context: { count: context.count + 1 } };
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
  for (let count = 1; count <= 2; count++) {
    const event = await resumed.waitForEvent();
    expect(event.type).toBe('INC');
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

it('rejects malformed pending events', async () => {
  const { snapshot } = await completedChild();
  const resumed = createDurable(parent, adapter());
  expect(() =>
    resumed.restore(parent.getPersistedSnapshot(snapshot), {
      // @ts-expect-error Exercise validation of untrusted host data.
      pendingEvents: [{ event: {} }]
    })
  ).toThrow('Invalid pendingEvents');
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
