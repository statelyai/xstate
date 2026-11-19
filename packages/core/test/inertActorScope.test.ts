import { setImmediate } from 'node:timers/promises';
import v8 from 'node:v8';
import vm from 'node:vm';
import { createMachine, initialTransition, transition } from '../src/index.ts';
import { withSystemInspector } from '../src/inspectionAmbient.ts';
import type { InspectionEvent } from '../src/inspection.ts';
import { createDurable } from '../src/durable/index.ts';
import {
  attachSnapshotActorRef,
  createInertActorScope,
  setInertActorScopeSnapshot
} from '../src/inertActorScope.ts';

let collect: (() => void) | undefined;
try {
  v8.setFlagsFromString('--expose-gc');
  const exposed: unknown = vm.runInNewContext('gc');
  if (typeof exposed === 'function') {
    collect = exposed as () => void;
  }
} catch {
  // Some runtimes do not permit exposing garbage collection.
}

describe('inert actor scopes', () => {
  it('keeps the current snapshot on self', () => {
    const child = createMachine({});
    const machine = createMachine({
      context: { count: 0 },
      invoke: { id: 'child', src: child }
    });
    const [previous] = initialTransition(machine);
    const scope = createInertActorScope(machine, previous);
    const self = scope.self;
    expect(self.getSnapshot()).toBe(previous);

    const current = { ...previous, context: { count: 1 } };
    setInertActorScopeSnapshot(scope, current, false);
    attachSnapshotActorRef(scope, current);
    expect(self.getSnapshot()).toBe(current);
  });

  it('updates a created identity scope when its source snapshot changes', () => {
    const machine = createMachine({
      context: { count: 0 },
      on: { INC: ({ context }) => ({ context: { count: context.count + 1 } }) }
    });
    const [first] = initialTransition(machine);
    const [second] = transition(machine, first, { type: 'INC' });
    const source = createInertActorScope(machine);
    setInertActorScopeSnapshot(source, first, false);
    attachSnapshotActorRef(source, first);
    const derived = createInertActorScope(machine, first, undefined, source);
    const inspected: InspectionEvent[] = [];
    withSystemInspector(
      (event) => inspected.push(event),
      () => {
        void derived.self;
      }
    );
    const announcement = inspected.find(
      (event) => event.type === '@xstate.actor'
    );
    expect(announcement).toBeDefined();
    expect(announcement!.actorRef.getSnapshot()).toBe(first);
    setInertActorScopeSnapshot(source, second, false);
    expect(announcement!.actorRef.getSnapshot()).toBe(second);
  });

  it.skipIf(!collect)(
    'allows earlier snapshots to be collected after transitions read self',
    async () => {
      const machine = createMachine({
        context: { count: 0 },
        on: {
          TICK: ({ context, self }) => {
            void self.id;
            return { context: { count: context.count + 1 } };
          }
        }
      });
      const durable = createDurable(machine, {
        executeAction: (action) => action.exec(),
        waitForEvent: () => new Promise(() => {})
      });
      const run = async () => {
        let [snapshot, effects] = durable.initialTransition();
        await durable.executeEffects(effects);
        let earlier: WeakRef<object> | undefined;
        for (let index = 1; index <= 1000; index++) {
          [snapshot, effects] = durable.transition(snapshot, { type: 'TICK' });
          await durable.executeEffects(effects);
          if (index === 10) {
            earlier = new WeakRef(snapshot);
          }
        }
        return { earlier, snapshot };
      };
      const { earlier, snapshot } = await run();
      expect(earlier).toBeDefined();
      await setImmediate();
      collect!();
      await setImmediate();
      collect!();
      expect(snapshot.context.count).toBe(1000);
      expect(earlier?.deref()).toBeUndefined();
    }
  );

  it.skipIf(!collect).each([false, true])(
    'releases the first snapshot with delayed identity access: %s',
    async (readSelf) => {
      const machine = createMachine({
        context: () => ({ marker: {}, count: 0, identity: '' }),
        on: {
          TICK: ({ context }) => ({
            context: { marker: {}, count: context.count + 1, identity: '' }
          }),
          SELF: ({ context, self }) => ({
            context: { ...context, identity: self.sessionId }
          })
        }
      });
      const run = () => {
        let [snapshot] = initialTransition(machine);
        const first = new WeakRef(snapshot.context.marker);
        for (let index = 0; index < 100; index++) {
          [snapshot] = transition(machine, snapshot, { type: 'TICK' });
        }
        if (readSelf) {
          [snapshot] = transition(machine, snapshot, { type: 'SELF' });
        }
        return { first, snapshot };
      };
      const { first, snapshot } = run();
      await setImmediate();
      collect!();
      await setImmediate();
      collect!();
      expect(first.deref()).toBeUndefined();
      expect(snapshot.context.count).toBe(100);
      const [next] = transition(machine, snapshot, { type: 'SELF' });
      const [last] = transition(machine, next, { type: 'SELF' });
      expect(next.context.identity).toBe(last.context.identity);
      if (readSelf) {
        expect(next.context.identity).toBe(snapshot.context.identity);
      }
    }
  );

  it.skipIf(!collect)(
    'keeps the snapshot alive when its materialized self is retained',
    async () => {
      const machine = createMachine({ context: () => ({ marker: {} }) });
      const run = () => {
        const [snapshot] = initialTransition(machine);
        const scope = createInertActorScope(machine);
        setInertActorScopeSnapshot(scope, snapshot, false);
        return {
          self: scope.self,
          marker: new WeakRef(snapshot.context.marker)
        };
      };
      const { self, marker } = run();
      await setImmediate();
      collect!();
      await setImmediate();
      collect!();
      expect(marker.deref()).toBeDefined();
      expect(self.getSnapshot().context.marker).toBe(marker.deref());
    }
  );

  it.skipIf(!collect)(
    'keeps adoption announcements readable after the first snapshot is collected',
    async () => {
      const inspected: InspectionEvent[] = [];
      const machine = createMachine({
        context: () => ({ marker: {}, count: 0 }),
        on: {
          TICK: ({ context }) => ({
            context: { marker: {}, count: context.count + 1 }
          })
        }
      });
      const run = () => {
        let [snapshot] = initialTransition(machine);
        const first = new WeakRef(snapshot.context.marker);
        for (let index = 0; index < 3; index++) {
          [snapshot] = transition(machine, snapshot, { type: 'TICK' });
        }
        return { first, snapshot };
      };
      const { first, snapshot } = run();
      await setImmediate();
      collect!();
      await setImmediate();
      collect!();
      expect(first.deref()).toBeUndefined();
      const durable = createDurable(
        machine,
        {
          executeAction: () => {},
          waitForEvent: () => {
            throw new Error('host-driven loop');
          }
        },
        { inspect: (event) => inspected.push(event) }
      );
      const [, effects] = durable.transition(snapshot, { type: 'TICK' });
      await durable.executeEffects(effects);
      const announcements = inspected.filter(
        (event) => event.type === '@xstate.actor'
      );
      expect(announcements.length > 0).toBe(true);
      for (const event of announcements) {
        expect(event.actorRef.getSnapshot()).toBeDefined();
      }
    }
  );
});
