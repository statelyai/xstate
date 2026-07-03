import { interval } from 'rxjs';
import {
  ActorRefFrom,
  createActor,
  createMachine,
  createObservableLogic,
  createAsyncLogic,
  createCallbackLogic
} from '../src';
import { z } from 'zod';

// TODO: deprecate syncSnapshot
describe('spawnChild action', () => {
  it('can spawn', () => {
    const actor = createActor(
      createMachine({
        entry: (_, enq) => {
          enq.spawn(createAsyncLogic({ run: () => Promise.resolve(42) }), {
            id: 'child'
          });
        }
      })
    );

    actor.start();

    expect(actor.getSnapshot().children.child).toBeDefined();
  });

  it('can spawn from named actor', () => {
    const fetchNum = createAsyncLogic({
      run: ({ input }: { input: number }) => Promise.resolve(input * 2)
    });
    const actor = createActor(
      createMachine({
        // types: {
        //   actorSources: {} as {
        //     src: 'fetchNum';
        //     logic: typeof fetchNum;
        //   }
        // },
        entry: (_, enq) => {
          enq.spawn(fetchNum, { id: 'child', input: 21 });
        }
      }).provide({
        actorSources: { fetchNum }
      })
    );

    actor.start();

    expect(actor.getSnapshot().children.child).toBeDefined();
  });

  it('should accept `syncSnapshot` option', async () => {
    const { promise, resolve } = Promise.withResolvers<void>();
    const observableLogic = createObservableLogic(() => interval(10));
    const observableMachine = createMachine({
      schemas: {
        context: z.object({
          observableRef: z.custom<ActorRefFrom<typeof observableLogic>>()
        })
      },
      id: 'observable',
      initial: 'idle',
      context: {
        observableRef: undefined! as ActorRefFrom<typeof observableLogic>
      },
      states: {
        idle: {
          entry: (_: unknown, enq: any) => {
            enq.spawn(observableLogic, {
              id: 'int',
              syncSnapshot: true
            });
          },
          on: {
            'xstate.snapshot.int': ({
              event
            }: {
              event: { snapshot: { context: number } };
            }) => {
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
      } as any
    });

    const observableService = createActor(observableMachine);
    observableService.subscribe({
      complete: () => {
        resolve();
      }
    });

    observableService.start();
    await promise;
  });

  it('should handle a dynamic id', () => {
    const spy = vi.fn();

    const childMachine = createMachine({
      on: {
        FOO: (_, enq) => {
          enq(spy);
        }
      }
    });

    const machine = createMachine({
      schemas: {
        context: z.object({
          childId: z.string()
        })
      },
      context: {
        childId: 'myChild'
      },
      entry: ({ context, self }, enq) => {
        // TODO: This should all be abstracted in enq.spawn(…)
        const child = createActor(childMachine, {
          id: context.childId,
          parent: self
        });
        enq(() => {
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

  it('does not start a child that is spawned and stopped in the same entry', () => {
    const started = vi.fn();

    const machine = createMachine({
      entry: (_, enq) => {
        const child = enq.spawn(
          createCallbackLogic(() => {
            started();
          }),
          { id: 'child' }
        );
        enq.stop(child);
      }
    });

    const actor = createActor(machine).start();

    // The appended start effect no-ops at runtime because the child was already
    // stopped in the same transition, so its callback logic never runs.
    expect(started).not.toHaveBeenCalled();
    expect(actor.getSnapshot().children.child).toBeUndefined();
  });

  it('does not start a child that is spawned in one microstep and stopped in a later microstep of the same macrostep', () => {
    const started = vi.fn();

    const machine = createMachine({
      context: {} as { child: any },
      initial: 'a',
      states: {
        a: {
          entry: (_, enq) => {
            const child = enq.spawn(
              createCallbackLogic(() => {
                started();
              }),
              { id: 'child' }
            );
            return { context: { child } };
          },
          always: { target: 'b' }
        },
        b: {
          entry: ({ context }, enq) => {
            enq.stop(context.child);
          }
        }
      }
    });

    const actor = createActor(machine).start();

    // All starts are deferred to the end of the macrostep's effects, while
    // stops execute at their authored positions — so the child is stopped
    // before its deferred start runs, and that start is a no-op.
    expect(started).not.toHaveBeenCalled();
    expect(actor.getSnapshot().value).toBe('b');
    expect(actor.getSnapshot().children.child).toBeUndefined();
  });
});
