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
});
