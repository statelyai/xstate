import {
  createActor,
  createCallbackLogic,
  createMachine,
  deliverEvent,
  setup,
  type ActorLogicValidator,
  type EventRejection,
  type InspectionEvent
} from '../src/index.ts';

type InspectedTransition = Extract<
  InspectionEvent,
  { type: '@xstate.transition' }
>;

function transitions(events: InspectionEvent[]): InspectedTransition[] {
  return events.filter((event) => event.type === '@xstate.transition');
}

describe('inspection event sources', () => {
  it('preserves an external source while a new child sends to its parent', () => {
    const childMachine = createMachine({
      entry: ({ parent }, enq) => {
        if (parent) {
          enq.sendTo(parent, { type: 'READY' });
        }
      }
    });
    const machine = createMachine({
      initial: 'waiting',
      states: {
        waiting: { on: { START: { target: 'running' } } },
        running: {
          invoke: { id: 'child', src: childMachine },
          on: { READY: {} }
        }
      }
    });
    const inspection: InspectionEvent[] = [];
    const actor = createActor(machine, {
      inspect: (event) => inspection.push(event)
    }).start();

    actor.send({ type: 'START' });

    const child = actor.getSnapshot().children.child;
    expect(
      transitions(inspection)
        .filter((event) => event.actorRef === actor)
        .map((event) => [event.event.type, event.sourceRef])
    ).toEqual([
      ['xstate.init', undefined],
      ['START', undefined],
      ['READY', child]
    ]);
    actor.stop();
  });

  it('keeps each prestart sender with its event for inspection and validation', () => {
    const first = createActor(createMachine({}));
    const second = createActor(createMachine({}));
    const check = vi.fn<ActorLogicValidator['check']>(() => undefined);
    const machine = setup({ validator: { check } }).createMachine({
      on: { FIRST: {}, SECOND: {}, EXTERNAL: {} }
    });
    const inspection: InspectionEvent[] = [];
    const actor = createActor(machine, {
      inspect: (event) => inspection.push(event)
    });

    deliverEvent(first, actor, { type: 'FIRST' });
    deliverEvent(second, actor, { type: 'SECOND' });
    actor.send({ type: 'EXTERNAL' });
    actor.start();

    expect(
      transitions(inspection).map((event) => [
        event.event.type,
        event.sourceRef
      ])
    ).toEqual([
      ['xstate.init', undefined],
      ['FIRST', first],
      ['SECOND', second],
      ['EXTERNAL', undefined]
    ]);
    expect(
      check.mock.calls.flatMap(([request]) =>
        request.kind === 'event'
          ? [[request.event.type, request.eventOrigin]]
          : []
      )
    ).toEqual([
      ['FIRST', 'actor'],
      ['SECOND', 'actor'],
      ['EXTERNAL', 'external']
    ]);
    actor.stop();
  });

  it('preserves interleaved child and external sources queued by effects', () => {
    const childLogic = createCallbackLogic<{ type: 'REQUEST' }>(
      ({ receive, sendBack }) => {
        receive(() => sendBack({ type: 'REPLY' }));
      }
    );
    const machine = createMachine({
      invoke: [
        { id: 'first', src: childLogic },
        { id: 'second', src: childLogic }
      ],
      on: {
        START: ({ children, self }, enq) => {
          enq(() => {
            children.first.send({ type: 'REQUEST' });
            children.second.send({ type: 'REQUEST' });
            self.send({ type: 'EXTERNAL' });
          });
        },
        REPLY: {},
        EXTERNAL: {}
      }
    });
    const inspection: InspectionEvent[] = [];
    const actor = createActor(machine, {
      inspect: (event) => inspection.push(event)
    }).start();
    const { first, second } = actor.getSnapshot().children;

    actor.send({ type: 'START' });

    expect(
      transitions(inspection)
        .filter((event) => event.actorRef === actor)
        .map((event) => [event.event.type, event.sourceRef])
    ).toEqual([
      ['xstate.init', undefined],
      ['START', undefined],
      ['REPLY', first],
      ['REPLY', second],
      ['EXTERNAL', undefined]
    ]);
    actor.stop();
  });

  it('discards queued sources at termination and reports each later sender', () => {
    const first = createActor(createMachine({}));
    const second = createActor(createMachine({}));
    const inspection: InspectionEvent[] = [];
    const rejections: EventRejection[] = [];
    const actor = createActor(
      createMachine({
        initial: 'active',
        states: {
          active: { on: { FINISH: { target: 'done' }, DROPPED: {} } },
          done: { type: 'final' }
        }
      }),
      {
        inspect: (event) => inspection.push(event),
        onRejectedEvent: (event) => rejections.push(event)
      }
    );
    deliverEvent(first, actor, { type: 'FINISH' });
    deliverEvent(second, actor, { type: 'DROPPED' });
    actor.start();
    deliverEvent(second, actor, { type: 'AFTER' });
    actor.send({ type: 'EXTERNAL' });

    expect(actor.getSnapshot().status).toBe('done');
    expect(
      transitions(inspection).map((event) => [
        event.event.type,
        event.sourceRef
      ])
    ).toEqual([
      ['xstate.init', undefined],
      ['FINISH', first]
    ]);
    expect(
      rejections.map((event) => [
        event.event.type,
        event.sourceRef,
        event.eventOrigin,
        event.reason
      ])
    ).toEqual([
      ['AFTER', second, 'actor', 'stopped'],
      ['EXTERNAL', undefined, 'external', 'stopped']
    ]);
  });
});
