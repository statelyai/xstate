import { createActor, createMachine } from '../src/index.ts';
import { createDurable } from '../src/durable/index.ts';
import { withSystemInspector } from '../src/inspectionAmbient.ts';
import {
  createSnapshotSystem,
  getSnapshotActorRef
} from '../src/snapshotActorRef.ts';

describe('snapshot system views', () => {
  it.each([
    { inspect: true, send: false },
    { inspect: false, send: true },
    { inspect: true, send: true }
  ])(
    'keeps a single delegation layer with inspect=$inspect and send=$send',
    async ({ inspect, send }) => {
      const machine = createMachine({
        context: { count: 0 },
        on: {
          TICK: ({ context, self }, enq) => {
            if (send) enq.sendTo(self, { type: 'NOOP' });
            return { context: { count: context.count + 1 } };
          },
          NOOP: () => {}
        }
      });
      let inspected = 0;
      let sent = 0;
      const durable = createDurable(
        machine,
        {
          executeAction: (effect) => effect.exec(),
          waitForEvent: () => ({ type: 'NOOP' }),
          sendEvent: () => {
            sent++;
          }
        },
        {
          captureRootEvents: false,
          ...(inspect
            ? {
                inspect: () => {
                  inspected++;
                }
              }
            : {})
        }
      );
      let [snapshot, effects] = durable.initialTransition();
      await durable.executeEffects(effects);
      for (let i = 0; i < 50; i++) {
        [snapshot, effects] = durable.transition(snapshot, { type: 'TICK' });
        await durable.executeEffects(effects);
        const system = getSnapshotActorRef(snapshot)!.actor.system;
        expect(Object.hasOwn(system, '_sendInspectionEvent')).toBe(true);
        expect(
          Object.hasOwn(Object.getPrototypeOf(system), '_sendInspectionEvent')
        ).toBe(false);
      }
      expect(snapshot.context.count).toBe(50);
      if (inspect) expect(inspected).toBeGreaterThanOrEqual(50);
      if (send) expect(sent).toBe(50);
    }
  );

  it('forwards inspection directly to the execution system', () => {
    const root = createActor(createMachine({}));
    const observed = vi.fn();
    root.system.inspect(observed);
    const hasObservers = vi.spyOn(root.system, '_hasInspectionObservers');
    const sendInspection = vi.spyOn(root.system, '_sendInspectionEvent');
    const views: Array<typeof root.system> = [];
    let system = root.system;
    withSystemInspector(observed, () => {
      for (let i = 0; i < 50; i++) {
        system = createSnapshotSystem(system, {});
        vi.spyOn(system, '_hasInspectionObservers');
        vi.spyOn(system, '_sendInspectionEvent');
        views.push(system);
      }
    });
    expect(system._hasInspectionObservers?.()).toBe(true);
    system._sendInspectionEvent({
      type: '@xstate.actor',
      actorRef: root,
      parentRef: undefined,
      id: root.id,
      src: root.logic,
      snapshot: root.getSnapshot()
    });
    expect(hasObservers).toHaveBeenCalledTimes(1);
    expect(sendInspection).toHaveBeenCalledTimes(1);
    expect(observed).toHaveBeenCalledTimes(1);
    for (const view of views.slice(0, -1)) {
      expect(view._hasInspectionObservers).not.toHaveBeenCalled();
      expect(view._sendInspectionEvent).not.toHaveBeenCalled();
    }
    expect(system._hasInspectionObservers).toHaveBeenCalledTimes(1);
    expect(system._sendInspectionEvent).toHaveBeenCalledTimes(1);
  });

  it('copies the current view registry and runtime without retaining it as prototype', () => {
    const root = createActor(createMachine({}));
    const external = createActor(createMachine({}));
    const first = createSnapshotSystem(root.system, {});
    first._register('external', external);
    first._set('external', external);
    first.runtime = { sendEvent: () => {} };
    first._snapshotVersion = 42;
    const next = createSnapshotSystem(first, {});
    expect(Object.getPrototypeOf(next)).toBe(root.system);
    expect(next.children.get('external')).toBe(external);
    expect(next.get('external')).toBe(external);
    expect(next.runtime).toBe(first.runtime);
    expect(next._snapshotVersion).toBe(42);
    expect(next._snapshot).toEqual(first._snapshot);
    expect(next._snapshot).not.toBe(first._snapshot);
    expect(next._clock).toBe(root.system._clock);
    expect(next.scheduler).toBe(root.system.scheduler);
    next._unregister(external);
    expect(first.get('external')).toBe(external);
  });
});
