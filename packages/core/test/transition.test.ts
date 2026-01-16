import { setTimeout as sleep } from 'node:timers/promises';
import {
  createMachine,
  EventFrom,
  fromPromise,
  fromTransition,
  toPromise,
  transition,
  ExecutableActionObject,
  SpecialExecutableAction
} from '../src';
import { createDoneActorEvent } from '../src/eventUtils';
import { initialTransition } from '../src/transition';
import { z } from 'zod';

describe('transition function', () => {
  it('should capture actions', () => {
    const actionWithParams = vi.fn();
    const actionWithDynamicParams = vi.fn();
    const stringAction = vi.fn();

    // const machine = setup({
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
    const machine = createMachine({
      schemas: {
        context: z.object({
          count: z.number()
        }),
        events: {
          event: z.object({ msg: z.string() }),
          stringAction: z.object({})
        }
      },
      entry: (_, enq) => {
        enq(actionWithParams, { a: 1 });
        enq(stringAction);
        return {
          context: { count: 100 }
        };
      },
      context: { count: 0 },
      on: {
        // event: {
        //   actions: {
        //     type: 'actionWithDynamicParams',
        //     params: ({ event }) => {
        //       return { msg: event.msg };
        //     }
        //   }
        // }
        event: ({ event }, enq) => {
          enq(actionWithDynamicParams, { msg: event.msg });
        }
      }
    });

    const [state0, actions0] = initialTransition(machine);

    expect(state0.context.count).toBe(100);
    expect(actions0).toEqual([
      expect.objectContaining({ args: [{ a: 1 }] }),
      expect.objectContaining({})
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
    const foo = vi.fn();

    const machine = createMachine({
      schemas: {
        context: z.object({
          count: z.number()
        })
      },
      actions: {
        foo
      },
      entry: ({ actions }, enq) => enq(actions.foo),
      context: { count: 0 }
    });

    const [, actions] = initialTransition(machine);

    expect(foo).not.toHaveBeenCalled();
  });

  it('should capture enqueued actions', () => {
    const machine = createMachine({
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

  it.todo('delayed raise actions should be returned', async () => {
    const machine = createMachine({
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
        type: '@xstate.raise',
        params: [{ type: 'NEXT' }, { delay: 10 }]
      })
    );
  });

  it('raise actions related to delayed transitions should be returned', async () => {
    const machine = createMachine({
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
        type: '@xstate.raise',
        // params: expect.objectContaining({
        //   delay: 10,
        //   event: { type: 'xstate.after.10.(machine).a' }
        // })
        args: [
          expect.anything(),
          { type: 'xstate.after.10.(machine).a' },
          expect.objectContaining({ delay: 10 })
        ]
      })
    );
  });

  it('cancel action should be returned', async () => {
    const machine = createMachine({
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
        type: '@xstate.cancel',
        // params: expect.objectContaining({
        //   sendId: 'myRaise'
        // })
        args: [expect.anything(), 'myRaise']
      })
    );
  });

  it('sendTo action should be returned', async () => {
    const machine = createMachine({
      initial: 'a',
      invoke: {
        src: createMachine({}),
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

    const [state, actions0] = initialTransition(machine);

    expect(state.value).toEqual('a');

    expect(actions0).toContainEqual(
      expect.objectContaining({
        type: '@xstate.start',
        args: [state.children.someActor]
      })
    );

    const [, actions] = transition(machine, state, { type: 'NEXT' });

    expect(actions).toContainEqual(
      expect.objectContaining({
        type: '@xstate.sendTo'
      })
    );
  });

  it('emit actions should be returned', async () => {
    const machine = createMachine({
      // types: {
      //   emitted: {} as { type: 'counted'; count: number }
      // },
      schemas: {
        context: z.object({
          count: z.number()
        }),
        emitted: {
          counted: z.object({
            count: z.number()
          })
        }
      },
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
        params: { count: 10 }
      })
    );
  });

  it('log actions should be returned', async () => {
    const machine = createMachine({
      schemas: {
        context: z.object({
          count: z.number()
        })
      },
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
        args: ['count: 10']
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
    const machine = createMachine({
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
    const fn = vi.fn();

    const machine = createMachine({
      initial: 'a',
      entry: (_, enq) => enq(fn),
      states: {
        a: {},
        b: {}
      }
    });

    initialTransition(machine);

    expect(fn).not.toHaveBeenCalled();
  });

  it('should not execute transition actions', () => {
    const fn = vi.fn();

    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            event: (_, enq) => {
              enq(fn);
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

    const machine = createMachine({
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

    async function execute(action: SpecialExecutableAction) {
      if (action.type === '@xstate.raise' && action.args[2]?.delay) {
        const currentTime = Date.now();
        const startedAt = currentTime;
        const elapsed = currentTime - startedAt;
        const timeRemaining = Math.max(0, action.args[2]?.delay - elapsed);

        await new Promise((res) => setTimeout(res, timeRemaining));
        postEvent(action.args[1]);
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

    const machine = createMachine({
      actors: {
        sendWelcomeEmail: fromPromise(async () => {
          calls.push('sendWelcomeEmail');
          return {
            status: 'sent'
          };
        })
      },
      initial: 'sendingWelcomeEmail',
      states: {
        sendingWelcomeEmail: {
          invoke: {
            src: ({ actors }) => actors.sendWelcomeEmail,
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

    async function execute(action: SpecialExecutableAction) {
      switch (action.type) {
        case '@xstate.start': {
          action.exec.apply(null, action.args);
          const startedActor = action.args[0];
          const output = await toPromise(startedActor);
          postEvent(createDoneActorEvent(startedActor.id, output));
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

  it('should support transition functions', () => {
    const fn = vi.fn();
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: {
              description: 'next',
              to: (_, enq) => {
                enq(fn);
                return {
                  target: 'b'
                };
              }
            }
          }
        },
        b: {}
      }
    });

    const [init] = initialTransition(machine);
    const [s1, actions] = transition(machine, init, { type: 'NEXT' });
    expect(s1.value).toEqual('b');
    expect(actions.length).toEqual(1);
  });
});
