import { setImmediate } from 'node:timers/promises';
import v8 from 'node:v8';
import vm from 'node:vm';
import {
  createActor,
  createCallbackLogic,
  createMachine,
  type ActorLogic,
  type InspectionEvent
} from '../src/index.ts';

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

type InspectedTransition = Extract<
  InspectionEvent,
  { type: '@xstate.transition' }
>;

function transitions(events: InspectionEvent[]): InspectedTransition[] {
  return events.filter((event) => event.type === '@xstate.transition');
}

describe('sent[] inspection', () => {
  it('reports only the sends made by the transition', () => {
    let sendBack: ((event: { type: string }) => void) | undefined;
    const machine = createMachine({
      invoke: {
        id: 'child',
        src: createCallbackLogic(({ sendBack: send, receive }) => {
          sendBack = send;
          receive(() => send({ type: 'ANSWER' }));
        })
      },
      on: { TICK: {}, ANSWER: {} }
    });
    const inspection: InspectionEvent[] = [];
    const actor = createActor(machine, {
      inspect: (event) => inspection.push(event)
    }).start();
    const child = actor.getSnapshot().children.child!;

    sendBack!({ type: 'TICK' });
    sendBack!({ type: 'TICK' });
    child.send({ type: 'ASK' });

    expect(
      transitions(inspection)
        .filter((event) => event.actorRef === child)
        .map((event) => [
          event.event.type,
          event.sent.map((sent) => sent.event.type)
        ])
    ).toEqual([
      ['xstate.init', []],
      ['ASK', ['ANSWER']]
    ]);
    expect(
      transitions(inspection)
        .filter((event) => event.actorRef === actor)
        .map((event) => [event.event.type, event.sourceRef])
    ).toEqual([
      ['xstate.init', undefined],
      ['TICK', child],
      ['TICK', child],
      ['ANSWER', child]
    ]);
    actor.stop();
  });

  it('reports sends made during the initial transition', () => {
    const snapshot = {
      status: 'active' as const,
      output: undefined,
      error: undefined
    };
    const logic: ActorLogic<typeof snapshot, { type: 'READY' }> = {
      initialTransition: (_, scope) => {
        scope.system.sendEvent(scope.self, scope.self, { type: 'READY' });
        return [snapshot, []];
      },
      transition: (current) => [current, []],
      getInitialSnapshot: () => snapshot,
      getPersistedSnapshot: (current) => current
    };
    const inspection: InspectionEvent[] = [];
    const actor = createActor(logic, {
      inspect: (event) => inspection.push(event)
    }).start();

    expect(
      transitions(inspection).map((event) => [
        event.event.type,
        event.sent.map((sent) => sent.event.type)
      ])
    ).toEqual([
      ['xstate.init', ['READY']],
      ['READY', []]
    ]);
    actor.stop();
  });

  it.skipIf(!collect)(
    'does not hold events a child sends to its parent outside a transition',
    async () => {
      let sendBack: ((event: { type: string }) => void) | undefined;
      const machine = createMachine({
        invoke: {
          id: 'child',
          src: createCallbackLogic(({ sendBack: send }) => {
            sendBack = send;
          })
        },
        on: { TICK: {} }
      });
      let inspected = 0;
      const actor = createActor(machine, {
        inspect: () => {
          inspected++;
        }
      }).start();
      let first: WeakRef<object> | undefined;
      for (let index = 0; index < 1000; index++) {
        const event = { type: 'TICK', payload: new Array(100).fill(index) };
        first ??= new WeakRef(event);
        sendBack!(event);
      }
      await setImmediate();
      collect!();
      await setImmediate();
      collect!();
      expect(inspected).toBeGreaterThan(1000);
      expect(first?.deref()).toBeUndefined();
      actor.stop();
    }
  );
});
