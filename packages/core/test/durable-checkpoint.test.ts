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

// Fixtures adapted from #5870 by @merrywhether.
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

function adapter(
  executionId?: string,
  transitionIndex?: number
): DurableExecutionAdapter<AnyActorLogic> {
  return {
    executionId,
    transitionIndex,
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
  'resumes a child completion captured before the checkpoint (executionId %s)',
  async (executionId) => {
    const { execution, snapshot } = await completedChild(executionId);
    const checkpoint = roundTrip(execution.checkpoint(snapshot));
    expect(checkpoint.nextTransitionIndex).toBe(2);
    expect(checkpoint.inbox).toEqual([
      {
        event: expect.objectContaining({
          type: 'xstate.done.actor',
          actorId: 'worker'
        }),
        source: { '@actor': 'parent/worker' }
      }
    ]);

    const resumed = createDurable(parent, adapter(executionId));
    let [restored, effects] = resumed.restore(checkpoint);
    expect(resumed.nextTransitionIndex).toBe(2);
    await resumed.executeEffects(effects);
    const event = await resumed.waitForEvent();
    expect(event.type).toBe('xstate.done.actor');
    [restored] = resumed.transition(restored, event);
    expect(restored.value).toBe('success');
  }
);

it('resumes raised events in order', async () => {
  const logic = createStepLogic<
    { count: number },
    unknown,
    { type: 'GO' } | { type: 'INC'; by: number }
  >({
    context: { count: 0 },
    run: ({ event, context }, enq) => {
      if (event.type === 'GO') {
        enq.raise({ type: 'INC', by: 1 });
        enq.raise({ type: 'INC', by: 10 });
      }
      if (event.type === 'INC')
        return { context: { count: context.count + event.by } };
    }
  });
  const original = createDurable(logic, adapter());
  let [snapshot, effects] = original.initialTransition();
  await original.executeEffects(effects);
  [snapshot, effects] = original.transition(snapshot, { type: 'GO' });
  await original.executeEffects(effects);
  const checkpoint = roundTrip(original.checkpoint(snapshot));
  expect(checkpoint.inbox.map(({ event }) => event)).toEqual([
    { type: 'INC', by: 1 },
    { type: 'INC', by: 10 }
  ]);

  const resumed = createDurable(logic, adapter());
  let [restored, restoreEffects] = resumed.restore(checkpoint);
  await resumed.executeEffects(restoreEffects);
  [restored] = resumed.transition(restored, await resumed.waitForEvent());
  [restored] = resumed.transition(restored, await resumed.waitForEvent());
  expect(restored.context.count).toBe(11);
  expect((await resumed.waitForEvent()).type).toBe('PING');
});

it('leaves events already taken by waitForEvent out of the checkpoint', async () => {
  const { execution, snapshot } = await completedChild();
  await execution.waitForEvent();
  expect(execution.checkpoint(snapshot).inbox).toEqual([]);
});

it('drops the completion of a child that a later transition replaced', async () => {
  const { execution, snapshot } = await completedChild();
  let [replacement, effects] = execution.transition(snapshot, {
    type: 'RESTART'
  });
  await execution.executeEffects(effects);
  expect(execution.checkpoint(replacement).inbox).toEqual([]);

  [replacement, effects] = execution.transition(replacement, { type: 'GO' });
  await execution.executeEffects(effects);
  const checkpoint = roundTrip(execution.checkpoint(replacement));
  expect(checkpoint.inbox).toHaveLength(1);

  const resumed = createDurable(parent, adapter());
  let [restored, restoreEffects] = resumed.restore(checkpoint);
  await resumed.executeEffects(restoreEffects);
  [restored] = resumed.transition(restored, await resumed.waitForEvent());
  expect(restored.value).toBe('success');
});

it('drops the completion of a child that is gone from the snapshot', async () => {
  const { execution, snapshot } = await completedChild();
  const [exited] = execution.transition(snapshot, { type: 'EXIT' });
  expect(execution.checkpoint(exited).inbox).toEqual([]);
});

it('rebinds a stored completion to the restored child session', async () => {
  const { execution, snapshot } = await completedChild();
  const checkpoint = roundTrip(execution.checkpoint(snapshot));
  checkpoint.inbox[0].event.sessionId = 'from-an-earlier-session';

  const resumed = createDurable(parent, adapter());
  const [restored, effects] = resumed.restore(checkpoint);
  await resumed.executeEffects(effects);
  const event = await resumed.waitForEvent();
  expect(event.sessionId).toBe(restored.children.worker!.sessionId);
});

it('does not store child snapshot updates; a restored child reports its snapshot on start', async () => {
  const counter = createStepLogic<{ count: number }, unknown, { type: 'INC' }>({
    context: { count: 0 },
    run: ({ context, event }) =>
      event.type === 'INC'
        ? { context: { count: context.count + 1 } }
        : undefined
  });
  const observer = createMachine({
    id: 'observer',
    actors: { counter },
    invoke: {
      id: 'counter',
      src: 'counter',
      onSnapshot: ({ event }) => ({
        context: { seen: event.snapshot.context.count }
      })
    },
    context: { seen: -1 },
    on: {
      INC: ({ children }, enq) => enq.sendTo(children.counter, { type: 'INC' })
    }
  });
  const original = createDurable(observer, adapter());
  let [snapshot, effects] = original.initialTransition();
  await original.executeEffects(effects);
  [snapshot, effects] = original.transition(snapshot, { type: 'INC' });
  await original.executeEffects(effects);
  const checkpoint = roundTrip(original.checkpoint(snapshot));
  expect(checkpoint.inbox).toEqual([]);

  const resumed = createDurable(observer, adapter());
  let [restored, restoreEffects] = resumed.restore(checkpoint);
  await resumed.executeEffects(restoreEffects);
  const event = await resumed.waitForEvent();
  expect(event.type).toBe('xstate.snapshot.actor');
  [restored] = resumed.transition(restored, event);
  expect(restored.context.seen).toBe(1);
});

it('rejects an invalid inbox', async () => {
  const { execution, snapshot } = await completedChild();
  const checkpoint = roundTrip(execution.checkpoint(snapshot));
  expect(() =>
    createDurable(parent, adapter()).restore({
      ...checkpoint,
      inbox: [{ event: {} } as any]
    })
  ).toThrow('The checkpoint inbox is invalid.');
});

it('rejects a transitionIndex that disagrees with the checkpoint', async () => {
  const { execution, snapshot } = await completedChild();
  const checkpoint = roundTrip(execution.checkpoint(snapshot));
  expect(() =>
    createDurable(parent, adapter(undefined, 5)).restore(checkpoint)
  ).toThrow(/does not match/);
  expect(() =>
    createDurable(parent, adapter(undefined, 2)).restore(checkpoint)
  ).not.toThrow();
});

it('still restores a bare persisted snapshot', async () => {
  const { snapshot } = await completedChild();
  const resumed = createDurable(parent, adapter(undefined, 2));
  const [restored] = resumed.restore(
    roundTrip(parent.getPersistedSnapshot(snapshot))
  );
  expect(restored.value).toBe('working');
  expect(resumed.nextTransitionIndex).toBe(2);
});
