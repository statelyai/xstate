import { interval } from 'rxjs';
import {
  ActorRefFrom,
  createActor,
  createMachine,
  fromObservable,
  fromPromise,
  sendTo,
  spawnChild
} from '../src';

describe('spawnChild action', () => {
  it('can spawn', () => {
    const actor = createActor(
      createMachine({
        entry: spawnChild(
          fromPromise(() => Promise.resolve(42)),
          { id: 'child' }
        )
      })
    );

    actor.start();

    expect(actor.getSnapshot().children.child).toBeDefined();
  });

  it('can spawn from named actor', () => {
    const fetchNum = fromPromise(({ input }: { input: number }) =>
      Promise.resolve(input * 2)
    );
    const actor = createActor(
      createMachine({
        types: {
          actors: {} as {
            src: 'fetchNum';
            logic: typeof fetchNum;
          }
        },
        entry: spawnChild('fetchNum', { id: 'child', input: 21 })
      }).provide({
        actors: { fetchNum }
      })
    );

    actor.start();

    expect(actor.getSnapshot().children.child).toBeDefined();
  });

  it('should accept `syncSnapshot` option', (done) => {
    const observableLogic = fromObservable(() => interval(10));
    const observableMachine = createMachine({
      id: 'observable',
      initial: 'idle',
      context: {
        observableRef: undefined! as ActorRefFrom<typeof observableLogic>
      },
      states: {
        idle: {
          entry: spawnChild(observableLogic, {
            id: 'int',
            syncSnapshot: true
          }),
          on: {
            'xstate.snapshot.int': {
              target: 'success',
              guard: ({ event }) => event.snapshot.context === 5
            }
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const observableService = createActor(observableMachine);
    observableService.subscribe({
      complete: () => {
        done();
      }
    });

    observableService.start();
  });

  it('should handle a dynamic id', () => {
    const spy = jest.fn();

    const child = createMachine({
      on: {
        FOO: {
          actions: spy
        }
      }
    });

    const machine = createMachine({
      context: {
        childId: 'myChild'
      },
      entry: [
        spawnChild(child, { id: ({ context }) => context.childId }),
        sendTo('myChild', {
          type: 'FOO'
        })
      ]
    });

    createActor(machine).start();

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
