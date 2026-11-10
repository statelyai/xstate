import { createActor, createMachine } from '../src/index.ts';
import { createDurable } from '../src/durable/index.ts';
import { withSystemInspector } from '../src/inspectionAmbient.ts';
import {
  adoptSystem,
  createSnapshotSystem,
  getSnapshotActorRef
} from '../src/snapshotActorRef.ts';

// Number of own-property layers above Object.prototype that resolve lookups.
function prototypeDepth(system: object): number {
  let depth = 0;
  for (
    let layer: object | null = system;
    layer && Object.hasOwn(layer, '_snapshot');
    layer = Object.getPrototypeOf(layer)
  ) {
    depth++;
  }
  return depth;
}

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
        // The view, the execution's first view, and the root system.
        expect(prototypeDepth(system)).toBeLessThanOrEqual(3);
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
    let system = root.system;
    withSystemInspector(observed, () => {
      for (let i = 0; i < 50; i++) {
        system = createSnapshotSystem(system, {});
      }
    });
    expect(Object.getPrototypeOf(system)).toBe(root.system);
    expect(system._hasInspectionObservers?.()).toBe(true);
    system._sendInspectionEvent({
      type: '@xstate.actor',
      actorRef: root,
      parentRef: undefined,
      id: root.id,
      src: root.logic,
      snapshot: root.getSnapshot()
    });
    expect(observed).toHaveBeenCalledTimes(1);
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

describe('snapshot system view facilities', () => {
  it('cancels through a later view a timer scheduled through an earlier one', () => {
    vi.useFakeTimers();
    try {
      const root = createActor(createMachine({})).start();
      const fired = vi
        .spyOn(root.system as any, '_deliver')
        .mockImplementation(() => {});
      const earlier = createSnapshotSystem(root.system, {});
      const later = createSnapshotSystem(earlier, {});
      earlier.schedule(root, { id: 'timer' } as any, 100);
      later.cancel(root, { id: 'timer' } as any);
      vi.advanceTimersByTime(200);
      expect(fired).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('notifies a listener added through an earlier view of rejections through a later one', () => {
    const root = createActor(createMachine({}));
    const earlier = createSnapshotSystem(root.system, {});
    const later = createSnapshotSystem(earlier, {});
    const listener = vi.fn();
    earlier.onRejectedEvent(listener);
    later.deadLetter(undefined, root, { type: 'LOST' }, 'stopped');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('forked execution systems', () => {
  it('starts a fork without the listeners of the system it forked from', () => {
    const root = createActor(createMachine({}));
    const listener = vi.fn();
    root.system.onRejectedEvent(listener);
    const fork = createSnapshotSystem(root.system, {}, undefined, {
      runtime: undefined,
      inspect: undefined
    });
    fork.deadLetter(undefined, root, { type: 'LOST' }, 'stopped');
    expect(listener).not.toHaveBeenCalled();
  });

  it('gives a fork its owner inspector and no other', () => {
    const root = createActor(createMachine({}));
    const other = vi.fn();
    root.system.inspect(other);
    const own = vi.fn();
    const fork = createSnapshotSystem(root.system, {}, undefined, {
      runtime: undefined,
      inspect: own
    });
    fork._sendInspectionEvent({
      type: '@xstate.actor',
      actorRef: root,
      parentRef: undefined,
      id: root.id,
      src: root.logic,
      snapshot: root.getSnapshot()
    });
    expect(own).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
  });

  it('installs a runtime on an adopted view without reaching the system it came from', () => {
    const live = createActor(createMachine({})).start();
    const view = createSnapshotSystem(live.system, {});
    const owner = { runtime: undefined, inspect: undefined };
    expect(adoptSystem(view, owner)).toBe(true);
    const runtime = {};
    view.runtime = runtime;
    expect(view.runtime).toBe(runtime);
    expect(live.system.runtime).not.toBe(runtime);
    expect(adoptSystem(view, { runtime: undefined, inspect: undefined })).toBe(
      false
    );
  });
});
