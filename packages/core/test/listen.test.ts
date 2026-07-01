import {
  createActor,
  createLogic,
  createMachine,
  createCallbackLogic,
  createAsyncLogic,
  types
} from '../src';
import type { AnyActor } from '../src';

describe('enq.listen()', () => {
  it('listens to emitted events from a spawned actor', async () => {
    // Use custom logic that emits when it receives an event
    const childLogic = createLogic<
      { triggered: boolean },
      undefined,
      { type: 'TRIGGER' },
      any, // TInput
      { type: 'childEvent'; value: number }
    >({
      context: { triggered: false },
      run: ({ context, event }, enq) => {
        if (event.type === 'TRIGGER') {
          enq.emit({ type: 'childEvent', value: 42 });
          return { context: { triggered: true } };
        }
        return;
      }
    });

    const receivedEvents: any[] = [];

    const parentMachine = createMachine({
      initial: 'active',
      states: {
        active: {
          entry: (_, enq) => {
            const childRef = enq.spawn(childLogic, { id: 'child' });
            enq.listen(childRef, 'childEvent', (ev) => ({
              type: 'CHILD_EMITTED',
              payload: (ev as any).value
            }));
            // Send event to child after a short delay
            setTimeout(() => {
              childRef.send({ type: 'TRIGGER' });
            }, 10);
          },
          on: {
            CHILD_EMITTED: ({ event }, enq) => {
              enq(() => receivedEvents.push(event));
              return {
                target: 'done'
              };
            }
          }
        },
        done: {
          type: 'final'
        }
      }
    });

    const actor = createActor(parentMachine);
    actor.start();

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].type).toBe('CHILD_EMITTED');
    expect(receivedEvents[0].payload).toBe(42);
  });

  it('listens to emitted events from a spawned actor during startup', () => {
    const childLogic = createCallbackLogic(({ emit }) => {
      emit({ type: 'childEvent' });
    });

    const receivedEvents: any[] = [];

    const parentMachine = createMachine({
      entry: (_, enq) => {
        const childRef = enq.spawn(childLogic, { id: 'child' });
        enq.listen(childRef, 'childEvent', () => ({ type: 'CHILD_EMITTED' }));
      },
      on: {
        CHILD_EMITTED: ({ event }, enq) => {
          enq(() => receivedEvents.push(event));
        }
      }
    });

    createActor(parentMachine).start();

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].type).toBe('CHILD_EMITTED');
  });

  it('listens to emitted events from an invoked actor during startup', () => {
    const childLogic = createCallbackLogic(({ emit }) => {
      emit({ type: 'childEvent' });
    });

    const receivedEvents: any[] = [];

    const parentMachine = createMachine({
      initial: 'active',
      states: {
        active: {
          invoke: {
            id: 'child',
            src: childLogic
          },
          entry: ({ children }, enq) => {
            enq.listen(children.child!, 'childEvent', () => ({
              type: 'CHILD_EMITTED'
            }));
          },
          on: {
            CHILD_EMITTED: ({ event }, enq) => {
              enq(() => receivedEvents.push(event));
            }
          }
        }
      }
    });

    createActor(parentMachine).start();

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].type).toBe('CHILD_EMITTED');
  });

  it('listens to emitted events from an actor passed through input', () => {
    const childLogic = createCallbackLogic(({ emit }) => {
      emit({ type: 'childEvent' });
    });

    const childRef = createActor(childLogic);
    const receivedEvents: any[] = [];

    const parentMachine = createMachine({
      schemas: {
        context: types<{ childRef: AnyActor }>(),
        input: types<{ childRef: AnyActor }>()
      },
      context: ({ input }) => ({
        childRef: input.childRef
      }),
      entry: ({ context }, enq) => {
        enq.listen(context.childRef, 'childEvent', () => ({
          type: 'CHILD_EMITTED'
        }));
      },
      on: {
        CHILD_EMITTED: ({ event }, enq) => {
          enq(() => receivedEvents.push(event));
        }
      }
    });

    createActor(parentMachine, { input: { childRef } }).start();
    childRef.start();

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].type).toBe('CHILD_EMITTED');
  });

  it('supports wildcard event matching', async () => {
    const childLogic = createCallbackLogic<
      any,
      any,
      { type: string; value: number }
    >(({ emit }) => {
      setTimeout(() => {
        emit({ type: 'data.update', value: 1 });
        emit({ type: 'data.delete', value: 2 });
      }, 10);
    });

    const receivedEvents: any[] = [];

    const parentMachine = createMachine({
      initial: 'active',
      states: {
        active: {
          entry: (_, enq) => {
            const childRef = enq.spawn(childLogic, { id: 'child' });
            enq.listen(childRef, 'data.*', (ev) => ({
              type: 'DATA_EVENT',
              eventType: ev.type,
              value: (ev as any).value
            }));
          },
          on: {
            DATA_EVENT: ({ event }, enq) => {
              enq(() => receivedEvents.push(event));
            }
          }
        }
      }
    });

    const actor = createActor(parentMachine).start();

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(receivedEvents).toHaveLength(2);
    expect(receivedEvents[0].eventType).toBe('data.update');
    expect(receivedEvents[1].eventType).toBe('data.delete');
  });

  it('stops listening when listener is stopped', async () => {
    const childLogic = createCallbackLogic<
      any,
      any,
      { type: 'tick'; count: number }
    >(({ emit }) => {
      let count = 0;
      const interval = setInterval(() => {
        emit({ type: 'tick', count: ++count });
      }, 10);
      return () => clearInterval(interval);
    });

    const receivedEvents: any[] = [];
    let listenerRef: AnyActor | undefined;

    const parentMachine = createMachine({
      initial: 'listening',
      states: {
        listening: {
          entry: (_, enq) => {
            const childRef = enq.spawn(childLogic, { id: 'child' });
            listenerRef = enq.listen(childRef, 'tick', (ev) => ({
              type: 'TICK',
              count: (ev as any).count
            }));
          },
          on: {
            TICK: ({ event }, enq) => {
              enq(() => receivedEvents.push(event));
            },
            STOP_LISTENING: {
              target: 'notListening'
            }
          }
        },
        notListening: {
          entry: (_, enq) => {
            if (listenerRef) {
              enq.stop(listenerRef);
            }
          }
        }
      }
    });

    const actor = createActor(parentMachine).start();

    // Wait for some ticks
    await new Promise((resolve) => setTimeout(resolve, 35));

    const countBeforeStop = receivedEvents.length;
    expect(countBeforeStop).toBeGreaterThan(0);

    // Stop listening
    actor.send({ type: 'STOP_LISTENING' });

    // Wait more
    await new Promise((resolve) => setTimeout(resolve, 35));

    // Should not have received more events after stopping
    expect(receivedEvents.length).toBe(countBeforeStop);
  });
});

describe('enq.subscribeTo()', () => {
  it('subscribes to done events from a spawned actor', async () => {
    const childLogic = createAsyncLogic({
      run: async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { result: 'success' };
      }
    });

    const receivedEvents: any[] = [];

    const parentMachine = createMachine({
      initial: 'active',
      states: {
        active: {
          entry: (_, enq) => {
            const childRef = enq.spawn(childLogic, { id: 'child' });
            enq.subscribeTo(childRef, {
              done: (output) => ({
                type: 'CHILD_DONE',
                output
              })
            });
          },
          on: {
            CHILD_DONE: ({ event }, enq) => {
              enq(() => receivedEvents.push(event));
              return {
                target: 'done'
              };
            }
          }
        },
        done: {
          type: 'final'
        }
      }
    });

    const actor = createActor(parentMachine);
    actor.start();

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(actor.getSnapshot().value).toBe('done');
    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].output).toEqual({ result: 'success' });
  });

  it('subscribes to error events from a spawned actor', async () => {
    const childLogic = createAsyncLogic({
      run: async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        throw new Error('child error');
      }
    });

    const receivedEvents: any[] = [];

    const parentMachine = createMachine({
      initial: 'active',
      states: {
        active: {
          entry: (_, enq) => {
            const childRef = enq.spawn(childLogic, { id: 'child' });
            enq.subscribeTo(childRef, {
              error: (err) => ({
                type: 'CHILD_ERROR',
                error: err
              })
            });
          },
          on: {
            CHILD_ERROR: ({ event }, enq) => {
              enq(() => receivedEvents.push(event));
              return {
                target: 'errored'
              };
            }
          }
        },
        errored: {
          type: 'final'
        }
      }
    });

    const actor = createActor(parentMachine);
    actor.start();

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(actor.getSnapshot().value).toBe('errored');
    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].error).toBeInstanceOf(Error);
  });

  it('subscribes to snapshot changes using shorthand', async () => {
    const childLogic = createLogic({
      context: {
        count: 0
      },
      run: ({ context, event }) => {
        if (event.type === '@xstate.init') {
          return;
        }
        return {
          context: {
            count: context.count + 1
          }
        };
      }
    });

    const snapshotChanges: any[] = [];

    const parentMachine = createMachine({
      initial: 'active',
      states: {
        active: {
          entry: (_, enq) => {
            const childRef = enq.spawn(childLogic, { id: 'child' });
            // Shorthand: single function for snapshot mapper
            enq.subscribeTo(childRef, (snapshot) => ({
              type: 'CHILD_SNAPSHOT',
              status: snapshot.status
            }));

            enq.sendTo(childRef, { type: 'increment' });
          },
          on: {
            CHILD_SNAPSHOT: ({ event }, enq) => {
              enq(() => snapshotChanges.push(event));
            }
          }
        }
      }
    });

    createActor(parentMachine).start();

    // Should have received at least one snapshot event
    expect(snapshotChanges.length).toBeGreaterThan(0);
  });

  it('subscribes to done events from a spawned actor during startup', () => {
    const childLogic = createLogic({
      context: undefined,
      run: () => {
        return {
          status: 'done',
          output: { result: 'success' }
        };
      }
    });

    const receivedEvents: any[] = [];

    const parentMachine = createMachine({
      entry: (_, enq) => {
        const childRef = enq.spawn(childLogic, { id: 'child' });
        enq.subscribeTo(childRef, {
          done: (output) => ({
            type: 'CHILD_DONE',
            output
          })
        });
      },
      on: {
        CHILD_DONE: ({ event }, enq) => {
          enq(() => receivedEvents.push(event));
        }
      }
    });

    createActor(parentMachine).start();

    expect(receivedEvents).toEqual([
      {
        type: 'CHILD_DONE',
        output: { result: 'success' }
      }
    ]);
  });

  it('subscribes to the initial active snapshot from a spawned actor during startup', () => {
    const childLogic = createLogic({
      context: { count: 0 },
      run: ({ context, event }) => {
        if (event.type === '@xstate.init') {
          return;
        }
        return {
          context: { count: context.count + 1 }
        };
      }
    });

    const snapshotChanges: any[] = [];

    const parentMachine = createMachine({
      entry: (_, enq) => {
        const childRef = enq.spawn(childLogic, { id: 'child' });
        enq.subscribeTo(childRef, (snapshot) => ({
          type: 'CHILD_SNAPSHOT',
          status: snapshot.status,
          context: snapshot.context
        }));
      },
      on: {
        CHILD_SNAPSHOT: ({ event }, enq) => {
          enq(() => snapshotChanges.push(event));
        }
      }
    });

    createActor(parentMachine).start();

    // The subscription is started before the child actor, so it receives the
    // child's initial active snapshot emitted during startup (count still 0).
    expect(snapshotChanges).toEqual([
      {
        type: 'CHILD_SNAPSHOT',
        status: 'active',
        context: { count: 0 }
      }
    ]);
  });

  it('does not subscribe to a spawned actor stopped before subscribing', () => {
    const childLogic = createLogic({
      context: undefined,
      run: () => {}
    });

    const snapshotChanges: any[] = [];

    const parentMachine = createMachine({
      entry: (_, enq) => {
        const childRef = enq.spawn(childLogic, { id: 'child' });
        enq.stop(childRef);
        enq.subscribeTo(childRef, (snapshot) => ({
          type: 'CHILD_SNAPSHOT',
          status: snapshot.status
        }));
      },
      on: {
        CHILD_SNAPSHOT: ({ event }, enq) => {
          enq(() => snapshotChanges.push(event));
        }
      }
    });

    createActor(parentMachine).start();

    expect(snapshotChanges).toEqual([]);
  });

  it('stops subscribing when subscription is stopped', async () => {
    const childLogic = createAsyncLogic({
      run: async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { result: 'success' };
      }
    });

    let receivedDone = false;
    let subscriptionRef: AnyActor | undefined;

    const parentMachine = createMachine({
      initial: 'active',
      states: {
        active: {
          entry: (_, enq) => {
            const childRef = enq.spawn(childLogic, { id: 'child' });
            subscriptionRef = enq.subscribeTo(childRef, {
              done: () => ({ type: 'CHILD_DONE' })
            });
          },
          on: {
            CHILD_DONE: (_, enq) => {
              enq(() => (receivedDone = true));
              return {
                target: 'unsubscribed'
              };
            },
            UNSUBSCRIBE: {
              target: 'unsubscribed'
            }
          }
        },
        unsubscribed: {
          entry: (_, enq) => {
            if (subscriptionRef) {
              enq.stop(subscriptionRef);
            }
          }
        }
      }
    });

    const actor = createActor(parentMachine).start();

    // Unsubscribe before child completes
    await new Promise((resolve) => setTimeout(resolve, 20));
    actor.send({ type: 'UNSUBSCRIBE' });

    // Wait for child to complete
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Should not have received done event
    expect(receivedDone).toBe(false);
  });
});
