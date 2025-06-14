import { sleep } from '@xstate-repo/jest-utils';
import {
  createActor,
  next_createMachine,
  EventFrom,
  ExecutableActionsFrom,
  ExecutableSpawnAction,
  fromPromise,
  fromTransition,
  toPromise,
  transition
} from '../src';
import { createDoneActorEvent } from '../src/eventUtils';
import { initialTransition } from '../src/transition';
import assert from 'node:assert';
import { resolveReferencedActor } from '../src/utils';
import z from 'zod';

describe('transition function', () => {
  it('should capture actions', () => {
    const actionWithParams = jest.fn();
    const actionWithDynamicParams = jest.fn();
    const stringAction = jest.fn();

    const machine =
      // setup({
      //   types: {
      //     context: {} as { count: number },
      //     events: {} as { type: 'event'; msg: string }
      //   },
      //   actions: {
      //     actionWithParams,
      //     actionWithDynamicParams: (_, params: { msg: string }) => {
      //       actionWithDynamicParams(params);
      //     },
      //     stringAction
      //   }
      // }).
      next_createMachine({
        schemas: {
          event: z.union([
            z.object({ type: z.literal('event'), msg: z.string() }),
            z.object({ type: z.literal('event2'), msg: z.string() })
          ])
        },
        entry: (_, enq) => {
          enq.action(actionWithParams, { a: 1 });
          enq.action(stringAction);
          return {
            context: { count: 100 }
          };
        },
        context: { count: 0 },
        on: {
          event: ({ event }, enq) => {
            enq.action(actionWithDynamicParams, { msg: event.msg });
          }
        }
      });

    const [state0, actions0] = initialTransition(machine);

    expect(state0.context.count).toBe(100);
    expect(actions0).toEqual([
      expect.objectContaining({ args: [{ a: 1 }] }),
      expect.objectContaining({ args: [] })
    ]);

    expect(actionWithParams).not.toHaveBeenCalled();
    expect(stringAction).not.toHaveBeenCalled();

    const [state1, actions1] = transition(machine, state0, {
      type: 'event',
      msg: 'hello'
    });

    expect(state1.context.count).toBe(100);
    expect(actions1).toEqual([
      expect.objectContaining({
        args: [{ msg: 'hello' }]
      })
    ]);

    expect(actionWithDynamicParams).not.toHaveBeenCalled();
  });

  it('should not execute a referenced serialized action', () => {
    const foo = jest.fn();

    const machine =
      // setup({
      //   actions: {
      //     foo
      //   }
      // }).
      next_createMachine({
        entry: foo,
        context: { count: 0 }
      });

    const [, actions] = initialTransition(machine);

    expect(foo).not.toHaveBeenCalled();
  });

  it('should capture enqueued actions', () => {
    const machine = next_createMachine({
      entry: (_, enq) => {
        enq.emit({ type: 'stringAction' });
        enq.emit({ type: 'objectAction' });
      }
    });

    const [_state, actions] = initialTransition(machine);

    expect(actions).toEqual([
      expect.objectContaining({ type: 'stringAction' }),
      expect.objectContaining({ type: 'objectAction' })
    ]);
  });

  it('delayed raise actions should be returned', async () => {
    const machine = next_createMachine({
      initial: 'a',
      states: {
        a: {
          entry: (_, enq) => {
            enq.raise({ type: 'NEXT' }, { delay: 10 });
          },
          on: {
            NEXT: 'b'
          }
        },
        b: {}
      }
    });

    const [state, actions] = initialTransition(machine);

    expect(state.value).toEqual('a');

    expect(actions[0]).toEqual(
      expect.objectContaining({
        type: 'xstate.raise',
        params: expect.objectContaining({
          delay: 10,
          event: { type: 'NEXT' }
        })
      })
    );
  });

  it('raise actions related to delayed transitions should be returned', async () => {
    const machine = next_createMachine({
      initial: 'a',
      states: {
        a: {
          after: { 10: 'b' }
        },
        b: {}
      }
    });

    const [state, actions] = initialTransition(machine);

    expect(state.value).toEqual('a');

    expect(actions[0]).toEqual(
      expect.objectContaining({
        type: 'xstate.raise',
        params: expect.objectContaining({
          delay: 10,
          event: { type: 'xstate.after.10.(machine).a' }
        })
      })
    );
  });

  it('cancel action should be returned', async () => {
    const machine = next_createMachine({
      initial: 'a',
      states: {
        a: {
          entry: (_, enq) => {
            enq.raise({ type: 'NEXT' }, { delay: 10, id: 'myRaise' });
          },
          on: {
            NEXT: (_, enq) => {
              enq.cancel('myRaise');
              return { target: 'b' };
            }
          }
        },
        b: {}
      }
    });

    const [state] = initialTransition(machine);

    expect(state.value).toEqual('a');

    const [, actions] = transition(machine, state, { type: 'NEXT' });

    expect(actions).toContainEqual(
      expect.objectContaining({
        type: 'xstate.cancel',
        params: expect.objectContaining({
          sendId: 'myRaise'
        })
      })
    );
  });

  it('sendTo action should be returned', async () => {
    const machine = next_createMachine({
      initial: 'a',
      invoke: {
        src: next_createMachine({}),
        id: 'someActor'
      },
      states: {
        a: {
          on: {
            NEXT: ({ children }, enq) => {
              enq.sendTo(children.someActor, { type: 'someEvent' });
            }
          }
        }
      }
    });

    const [state0, actions0] = initialTransition(machine);

    expect(state0.value).toEqual('a');

    expect(actions0).toContainEqual(
      expect.objectContaining({
        type: 'xstate.spawnChild',
        params: expect.objectContaining({
          id: 'someActor'
        })
      })
    );

    const [state1, actions1] = transition(machine, state0, { type: 'NEXT' });

    expect(actions1).toContainEqual(
      expect.objectContaining({
        type: 'xstate.sendTo',
        params: expect.objectContaining({
          to: state1.children.someActor,
          event: { type: 'someEvent' }
        })
      })
    );
  });

  it('emit actions should be returned', async () => {
    const machine = next_createMachine({
      // types: {
      //   emitted: {} as { type: 'counted'; count: number }
      // },
      initial: 'a',
      context: { count: 10 },
      states: {
        a: {
          on: {
            NEXT: ({ context }, enq) => {
              enq.emit({
                type: 'counted',
                count: context.count
              });
            }
          }
        }
      }
    });

    const [state] = initialTransition(machine);

    expect(state.value).toEqual('a');

    const [, nextActions] = transition(machine, state, { type: 'NEXT' });

    expect(nextActions).toContainEqual(
      expect.objectContaining({
        type: 'counted',
        params: {
          count: 10
        }
      })
    );
  });

  it('log actions should be returned', async () => {
    const machine = next_createMachine({
      initial: 'a',
      context: { count: 10 },
      states: {
        a: {
          on: {
            NEXT: ({ context }, enq) => {
              enq.log(`count: ${context.count}`);
            }
          }
        }
      }
    });

    const [state] = initialTransition(machine);

    expect(state.value).toEqual('a');

    const [, nextActions] = transition(machine, state, { type: 'NEXT' });

    expect(nextActions).toContainEqual(
      expect.objectContaining({
        type: 'xstate.log',
        params: expect.objectContaining({
          value: 'count: 10'
        })
      })
    );
  });

  it('should calculate the next snapshot for transition logic', () => {
    const logic = fromTransition(
      (state, event) => {
        if (event.type === 'next') {
          return { count: state.count + 1 };
        } else {
          return state;
        }
      },
      { count: 0 }
    );

    const [init] = initialTransition(logic);
    const [s1] = transition(logic, init, { type: 'next' });
    expect(s1.context.count).toEqual(1);
    const [s2] = transition(logic, s1, { type: 'next' });
    expect(s2.context.count).toEqual(2);
  });

  it('should calculate the next snapshot for machine logic', () => {
    const machine = next_createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: 'b'
          }
        },
        b: {
          on: {
            NEXT: 'c'
          }
        },
        c: {}
      }
    });

    const [init] = initialTransition(machine);
    const [s1] = transition(machine, init, { type: 'NEXT' });

    expect(s1.value).toEqual('b');

    const [s2] = transition(machine, s1, { type: 'NEXT' });

    expect(s2.value).toEqual('c');
  });

  it('should not execute entry actions', () => {
    const fn = jest.fn();

    const machine = next_createMachine({
      initial: 'a',
      entry: fn,
      states: {
        a: {},
        b: {}
      }
    });

    initialTransition(machine);

    expect(fn).not.toHaveBeenCalled();
  });

  it('should not execute transition actions', () => {
    const fn = jest.fn();

    const machine = next_createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            event: (_, enq) => {
              enq.action(fn);
              return { target: 'b' };
            }
          }
        },
        b: {}
      }
    });

    const [init] = initialTransition(machine);
    const [nextSnapshot] = transition(machine, init, { type: 'event' });

    expect(fn).not.toHaveBeenCalled();
    expect(nextSnapshot.value).toEqual('b');
  });

  it('delayed events example (experimental)', async () => {
    const db = {
      state: undefined as any
    };

    const machine = next_createMachine({
      initial: 'start',
      states: {
        start: {
          on: {
            next: 'waiting'
          }
        },
        waiting: {
          after: {
            10: 'done'
          }
        },
        done: {
          type: 'final'
        }
      }
    });

    async function execute(action: ExecutableActionsFrom<typeof machine>) {
      if (action.type === 'xstate.raise' && action.params.delay) {
        const currentTime = Date.now();
        const startedAt = currentTime;
        const elapsed = currentTime - startedAt;
        const timeRemaining = Math.max(0, action.params.delay - elapsed);

        await new Promise((res) => setTimeout(res, timeRemaining));
        postEvent(action.params.event);
      }
    }

    // POST /workflow
    async function postStart() {
      const [state, actions] = initialTransition(machine);

      db.state = JSON.stringify(state);

      // execute actions
      for (const action of actions) {
        await execute(action);
      }
    }

    // POST /workflow/{sessionId}
    async function postEvent(event: EventFrom<typeof machine>) {
      const [nextState, actions] = transition(
        machine,
        machine.resolveState(JSON.parse(db.state)),
        event
      );

      db.state = JSON.stringify(nextState);

      for (const action of actions) {
        await execute(action);
      }
    }

    await postStart();
    postEvent({ type: 'next' });

    await sleep(15);
    expect(JSON.parse(db.state).status).toBe('done');
  });

  it('serverless workflow example (experimental)', async () => {
    const db = {
      state: undefined as any
    };

    const machine =
      // setup({
      //   actors: {
      //     sendWelcomeEmail: fromPromise(async () => {
      //       calls.push('sendWelcomeEmail');
      //       return {
      //         status: 'sent'
      //       };
      //     })
      //   }
      // }).
      next_createMachine({
        initial: 'sendingWelcomeEmail',
        states: {
          sendingWelcomeEmail: {
            invoke: {
              src: 'sendWelcomeEmail',
              input: () => ({ message: 'hello world', subject: 'hi' }),
              onDone: 'logSent'
            }
          },
          logSent: {
            invoke: {
              src: fromPromise(async () => {}),
              onDone: 'finish'
            }
          },
          finish: {}
        }
      });

    const calls: string[] = [];

    async function execute(action: ExecutableActionsFrom<typeof machine>) {
      switch (action.type) {
        case 'xstate.spawnChild': {
          const spawnAction = action as ExecutableSpawnAction;
          const logic =
            typeof spawnAction.params.src === 'string'
              ? resolveReferencedActor(machine, spawnAction.params.src)
              : spawnAction.params.src;
          assert('transition' in logic);
          const output = await toPromise(
            createActor(logic, spawnAction.params).start()
          );
          postEvent(createDoneActorEvent(spawnAction.params.id, output));
        }
        default:
          break;
      }
    }

    // POST /workflow
    async function postStart() {
      const [state, actions] = initialTransition(machine);

      db.state = JSON.stringify(state);

      // execute actions
      for (const action of actions) {
        await execute(action);
      }
    }

    // POST /workflow/{sessionId}
    async function postEvent(event: EventFrom<typeof machine>) {
      const [nextState, actions] = transition(
        machine,
        machine.resolveState(JSON.parse(db.state)),
        event
      );

      db.state = JSON.stringify(nextState);

      // "sync" built-in actions: assign, raise, cancel, stop
      // "external" built-in actions: sendTo, raise w/delay, log
      for (const action of actions) {
        await execute(action);
      }
    }

    await postStart();
    postEvent({ type: 'sent' });

    expect(calls).toEqual(['sendWelcomeEmail']);

    await sleep(10);
    expect(JSON.parse(db.state).value).toBe('finish');
  });
});
