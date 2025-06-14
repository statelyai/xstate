import { interval } from 'rxjs';
import {
  ActorRefFrom,
  createActor,
  next_createMachine,
  fromObservable,
  fromPromise
} from '../src';

describe('spawnChild action', () => {
  it('can spawn', () => {
    const actor = createActor(
      next_createMachine({
        entry: (_, enq) => {
          enq.spawn(
            fromPromise(() => Promise.resolve(42)),
            { id: 'child' }
          );
        }
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
      next_createMachine({
        // types: {
        //   actors: {} as {
        //     src: 'fetchNum';
        //     logic: typeof fetchNum;
        //   }
        // },
        entry: (_, enq) => {
          enq.spawn(fetchNum, { id: 'child', input: 21 });
        }
      }).provide({
        actors: { fetchNum }
      })
    );

    actor.start();

    expect(actor.getSnapshot().children.child).toBeDefined();
  });

  it('should accept `syncSnapshot` option', (done) => {
    const observableLogic = fromObservable(() => interval(10));
    const observableMachine = next_createMachine({
      id: 'observable',
      initial: 'idle',
      context: {
        observableRef: undefined! as ActorRefFrom<typeof observableLogic>
      },
      states: {
        idle: {
          entry: (_, enq) => {
            enq.spawn(observableLogic, {
              id: 'int',
              syncSnapshot: true
            });
          },
          on: {
            'xstate.snapshot.int': ({ event }) => {
              if (event.snapshot.context === 5) {
                return {
                  target: 'success'
                };
              }
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

    const childMachine = next_createMachine({
      on: {
        FOO: (_, enq) => {
          enq.action(spy);
        }
      }
    });

    const machine = next_createMachine({
      context: {
        childId: 'myChild'
      },
      entry: ({ context, self }, enq) => {
        // TODO: This should all be abstracted in enq.spawn(…)
        const child = createActor(childMachine, {
          id: context.childId,
          parent: self
        });
        enq.action(() => {
          child.start();
        });

        enq.sendTo(child, {
          type: 'FOO'
        });
      }
    });

    createActor(machine).start();

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
