import { expect, it } from 'vitest';
import { setup, createMachine, createStepLogic, stopActor } from 'xstate';
import { createDurable } from 'xstate/durable';
import { deliverEvent } from '../src/runtimeHelpers.ts';
const J = (x: unknown) => JSON.parse(JSON.stringify(x));
const child = createMachine({
  initial: 'w',
  states: { w: { on: { WORK: { target: 'd' } } }, d: { type: 'final' } }
} as any);
const parent = setup({ actors: { child } } as any).createMachine({
  initial: 'working',
  states: {
    working: {
      invoke: { id: 'child', src: 'child', onDone: { target: 'success' } },
      on: {
        GO: ({ children }: any, enq: any) =>
          enq.sendTo(children.child, { type: 'WORK' })
      }
    },
    success: {}
  }
} as any);
const adapter = (events: any[]) => ({
  executeAction: (e: any) => e.exec(),
  waitForEvent: async () => events.shift() ?? new Promise(() => {}),
  spawnActor: () => {},
  startActor: (a: any) => {
    a.start();
  },
  stopActor,
  sendEvent: (s: any, t: any, e: any) => deliverEvent(s, t, e)
});
it.each([undefined, 'pinned'])(
  'restores child completion with executionId %s',
  async (executionId) => {
    const d = createDurable(
      parent as any,
      { ...adapter([]), executionId } as any
    );
    let [s, fx] = d.initialTransition();
    await d.executeEffects(fx);
    [s, fx] = d.transition(s, { type: 'GO' } as any);
    await d.executeEffects(fx);
    const cp = J((parent as any).getPersistedSnapshot(s));
    const pendingEvents = d.getPendingEvents(s);
    expect(pendingEvents[0].source).toEqual({ $actor: expect.any(String) });
    const next = await d.waitForEvent();
    expect(next.type).toBe('xstate.done.actor');
    const d2 = createDurable(
      parent as any,
      { ...adapter([{ type: 'PING' }]), executionId } as any
    );
    let [r, rfx] = d2.restore(cp, { pendingEvents });
    await d2.executeEffects(rfx);
    const ev = await Promise.race([
      d2.waitForEvent(),
      new Promise((res) => setTimeout(() => res({ type: 'NOTHING' }), 50))
    ]);
    expect((ev as any).type).toBe('xstate.done.actor');
    [r] = d2.transition(r, ev as any);
    expect(r.value).toBe('success');
  }
);

it('restores raised events for generic step logic in order', async () => {
  const logic = createStepLogic({
    context: { count: 0 },
    run: ({ event, context }, enq) => {
      if (event.type === 'GO') {
        const first = { type: 'INC', payload: new Date(0) };
        const second = { type: 'INC', payload: NaN };
        enq.raise(first);
        enq.raise(second);
      }
      if (event.type === 'INC')
        return { context: { count: context.count + 1 } };
    }
  });
  const host = adapter([{ type: 'HOST' }]);
  const original = createDurable(logic, host);
  let [snapshot, effects] = original.initialTransition();
  await original.executeEffects(effects);
  [snapshot, effects] = original.transition(snapshot, { type: 'GO' });
  await original.executeEffects(effects);
  const pendingEvents = original.getPendingEvents(snapshot);
  expect(pendingEvents).toHaveLength(2);
  expect(pendingEvents[0].event.payload).toBeInstanceOf(Date);
  expect(original.getPendingEvents(snapshot)[0].event).toBe(
    pendingEvents[0].event
  );
  const saved = original.getActorRef(snapshot)!.getPersistedSnapshot();
  const restored = createDurable(logic, host);
  let [resumed, restoreEffects] = restored.restore(saved, { pendingEvents });
  await restored.executeEffects(restoreEffects);
  for (let count = 1; count <= 2; count++) {
    const event = await restored.waitForEvent();
    expect(event.type).toBe('INC');
    [resumed] = restored.transition(resumed, event);
    expect(resumed.context.count).toBe(count);
  }
  expect((await restored.waitForEvent()).type).toBe('HOST');
});

it('rejects malformed pending events and retains old behavior when omitted', async () => {
  const execution = createDurable(
    parent as any,
    adapter([{ type: 'PING' }]) as any
  );
  const [snapshot, effects] = execution.initialTransition();
  await execution.executeEffects(effects);
  const saved = (parent as any).getPersistedSnapshot(snapshot);
  const resumed = createDurable(
    parent as any,
    adapter([{ type: 'PING' }]) as any
  );
  expect(() =>
    resumed.restore(saved, { pendingEvents: [{ event: {} }] } as any)
  ).toThrow('Invalid pendingEvents');
  const fresh = createDurable(
    parent as any,
    adapter([{ type: 'PING' }]) as any
  );
  const [, restoreEffects] = fresh.restore(saved);
  await fresh.executeEffects(restoreEffects);
  expect((await fresh.waitForEvent()).type).toBe('PING');
});

it('drops a completion whose child has a different current session', async () => {
  const execution = createDurable(parent as any, adapter([]) as any);
  let [snapshot, effects] = execution.initialTransition();
  await execution.executeEffects(effects);
  [snapshot, effects] = execution.transition(snapshot, { type: 'GO' } as any);
  await execution.executeEffects(effects);
  const event = execution.getPendingEvents(snapshot)[0].event;
  event.sessionId = 'retired-session';
  expect(execution.getPendingEvents(snapshot)).toEqual([]);
});
