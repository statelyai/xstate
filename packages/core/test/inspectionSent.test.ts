import { setImmediate } from 'node:timers/promises';
import v8 from 'node:v8';
import vm from 'node:vm';
import { Subject } from 'rxjs';
import {
  createActor,
  createCallbackLogic,
  createEventObservableLogic,
  createMachine,
  type AnyActor,
  type AnyActorRef,
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
  it('reports callback sends in the callback actor transitions', () => {
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
    let childSnapshots = 0;
    child.subscribe(() => childSnapshots++);
    const beforeSends = childSnapshots;

    sendBack!({ type: 'TICK' });
    sendBack!({ type: 'TICK' });
    expect(childSnapshots - beforeSends).toBe(2);
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
      ['xstate.callback.sendBack', ['TICK']],
      ['xstate.callback.sendBack', ['TICK']],
      ['ASK', ['xstate.callback.sendBack']],
      ['xstate.callback.sendBack', ['ANSWER']]
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

  it('reports event observable sends in the source transition', () => {
    const stream = new Subject<{ type: 'TICK' }>();
    const machine = createMachine({
      invoke: {
        id: 'stream',
        src: createEventObservableLogic(() => stream)
      },
      on: { TICK: {} }
    });
    const inspection: InspectionEvent[] = [];
    const actor = createActor(machine, {
      inspect: (event) => inspection.push(event)
    }).start();
    const child = actor.getSnapshot().children.stream!;

    stream.next({ type: 'TICK' });

    expect(
      transitions(inspection)
        .filter((event) => event.actorRef === child)
        .map((event) => [
          event.event.type,
          event.sent.map((sent) => sent.event.type)
        ])
    ).toEqual([
      ['xstate.init', []],
      ['xstate.observable.next', ['TICK']]
    ]);
    expect(
      transitions(inspection)
        .filter((event) => event.actorRef === actor)
        .map((event) => event.event.type)
    ).toEqual(['xstate.init', 'TICK']);
    actor.stop();
  });

  it('reports listener sends in the listener transition', () => {
    let emitSource: ((event: { type: 'PING' }) => void) | undefined;
    let listener: AnyActor | undefined;
    const source = createCallbackLogic(({ emit }) => {
      emitSource = emit;
    });
    const machine = createMachine({
      entry: (_, enq) => {
        const child = enq.spawn(source);
        listener = enq.listen(child, 'PING', () => ({ type: 'PONG' }));
      },
      on: { PONG: {} }
    });
    const inspection: InspectionEvent[] = [];
    const actor = createActor(machine, {
      inspect: (event) => inspection.push(event)
    }).start();

    emitSource!({ type: 'PING' });

    expect(
      transitions(inspection)
        .filter((event) => event.actorRef === listener)
        .map((event) => [
          event.event.type,
          event.sent.map((sent) => sent.event.type)
        ])
    ).toEqual([
      ['xstate.init', []],
      ['xstate.attached.forward', ['PONG']]
    ]);
    actor.stop();
  });

  it('reports subscription sends in the subscription transition', () => {
    let source: AnyActorRef | undefined;
    let subscription: AnyActor | undefined;
    const childLogic = createMachine({
      context: { count: 0 },
      on: {
        INC: ({ context }) => ({ context: { count: context.count + 1 } })
      }
    });
    const machine = createMachine({
      entry: (_, enq) => {
        source = enq.spawn(childLogic);
        subscription = enq.subscribeTo(source, {
          snapshot: () => ({ type: 'CHANGED' })
        });
      },
      on: { CHANGED: {} }
    });
    const inspection: InspectionEvent[] = [];
    const actor = createActor(machine, {
      inspect: (event) => inspection.push(event)
    }).start();
    const before = inspection.length;

    source!.send({ type: 'INC' });

    expect(
      transitions(inspection.slice(before))
        .filter((event) => event.actorRef === subscription)
        .map((event) => [
          event.event.type,
          event.sent.map((sent) => sent.event.type)
        ])
    ).toEqual([['xstate.attached.forward', ['CHANGED']]]);
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
