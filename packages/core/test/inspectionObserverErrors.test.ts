import {
  createActor,
  createMachine,
  isMachineSnapshot,
  type InspectionEvent
} from '../src/index.ts';

describe('inspection observer errors', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('reports actor creation observer failures asynchronously', () => {
    const error = new Error('inspector failed during creation');

    expect(() =>
      createActor(createMachine({}), {
        inspect: () => {
          throw error;
        }
      })
    ).not.toThrow();
    expect(() => vi.runOnlyPendingTimers()).toThrow(error);
  });

  it('starts despite an inspector error and notifies later inspectors', () => {
    const error = new Error('inspector failed during start');
    const events: InspectionEvent[] = [];
    const actor = createActor(
      createMachine({
        initial: 'ready',
        states: { ready: {} }
      })
    );
    const received: InspectionEvent[] = [];
    const observer = {
      events: received,
      next(event: InspectionEvent) {
        this.events.push(event);
        throw error;
      }
    };
    actor.system.inspect(observer);
    actor.system.inspect((event) => events.push(event));
    const actorError = vi.fn();
    actor.subscribe({ error: actorError });

    expect(() => actor.start()).not.toThrow();

    expect(actor.getSnapshot()).toMatchObject({
      status: 'active',
      value: 'ready'
    });
    expect(actorError).not.toHaveBeenCalled();
    expect(observer.events).toHaveLength(1);
    expect(events).toEqual(observer.events);
    expect(events[0]).toMatchObject({
      type: '@xstate.transition',
      event: { type: 'xstate.init' }
    });
    expect(() => vi.runOnlyPendingTimers()).toThrow(error);
  });

  it('keeps processing events after an inspector throws during send', () => {
    const error = new Error('inspector failed during send');
    const events: InspectionEvent[] = [];
    const actor = createActor(
      createMachine({
        initial: 'one',
        states: {
          one: { on: { NEXT: { target: 'two' } } },
          two: { on: { NEXT: { target: 'three' } } },
          three: {}
        }
      }),
      {
        inspect: (event) => {
          if (
            event.type === '@xstate.transition' &&
            event.event.type === 'NEXT' &&
            isMachineSnapshot(event.snapshot) &&
            event.snapshot.matches('two')
          ) {
            throw error;
          }
        }
      }
    ).start();
    actor.system.inspect((event) => events.push(event));
    const actorError = vi.fn();
    actor.subscribe({ error: actorError });

    expect(() => actor.send({ type: 'NEXT' })).not.toThrow();
    expect(() => actor.send({ type: 'NEXT' })).not.toThrow();

    expect(actor.getSnapshot()).toMatchObject({
      status: 'active',
      value: 'three'
    });
    expect(actorError).not.toHaveBeenCalled();
    expect(events.map((event) => event.snapshot)).toMatchObject([
      { value: 'two', status: 'active' },
      { value: 'three', status: 'active' }
    ]);
    expect(() => vi.runOnlyPendingTimers()).toThrow(error);
    actor.stop();
  });
});
