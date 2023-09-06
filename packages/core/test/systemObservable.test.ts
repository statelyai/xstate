import { Actor, assign, createActor, createMachine, stop } from '../src/index';
import { createSystemObservable } from '../src/systemObservable';

describe('observable system', () => {
  const counterMachine = createMachine({
    context: {
      count: 0
    },
    on: {
      increment: {
        actions: assign({
          count: ({ context }) => context.count + 1
        })
      }
    }
  });

  const machine = createMachine({
    id: 'main',
    initial: 'idle',
    invoke: {
      src: counterMachine,
      systemId: 'counter'
    },
    on: {
      'counter.stop': { actions: stop(({ system }) => system.get('counter')) }
    },
    states: {
      idle: {
        on: {
          done: 'done'
        }
      },
      done: { type: 'final' }
    }
  });

  let mainActor: Actor<typeof machine>;
  let counterActor: Actor<typeof counterMachine>;

  beforeEach(() => {
    mainActor = createActor(machine).start();
    counterActor = mainActor.system.get('counter');
  });

  it('should allow to subscribe to all actors in the system', (done) => {
    const systemObservable = createSystemObservable(mainActor.system);

    counterActor.send({ type: 'increment' });

    const observer = {
      next: jest.fn(),
      complete: jest.fn().mockImplementation(done)
    };
    const sub = systemObservable.subscribe(observer);

    counterActor.send({ type: 'increment' });

    expect(observer.next).toBeCalledWith({
      actorRef: counterActor,
      snapshot: counterActor.getSnapshot()
    });

    observer.next.mockReset();

    mainActor.send({ type: 'done' });

    expect(observer.next).toHaveBeenCalledTimes(2);

    expect(observer.next).nthCalledWith(1, {
      actorRef: counterActor,
      snapshot: counterActor.getSnapshot()
    });

    expect(observer.next).nthCalledWith(2, {
      actorRef: mainActor,
      snapshot: mainActor.getSnapshot()
    });

    expect(observer.complete).toHaveBeenCalledTimes(1);
  });
});
