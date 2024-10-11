import { sleep } from '@xstate-repo/jest-utils';
import {
  assign,
  createActor,
  createMachine,
  enqueueActions,
  EventFrom,
  ExecutableActionsFrom,
  ExecutableSpawnAction,
  fromPromise,
  fromTransition,
  raise,
  setup,
  toPromise,
  transition,
  waitFor
} from '../src';
import { createDoneActorEvent } from '../src/eventUtils';
import { initialTransition } from '../src/transition';

describe('transition function', () => {
  it('should capture actions', () => {
    const actionWithParams = jest.fn();
    const actionWithDynamicParams = jest.fn();
    const stringAction = jest.fn();

    const machine = setup({
      types: {
        context: {} as { count: number },
        events: {} as { type: 'event'; msg: string }
      },
      actions: {
        actionWithParams,
        actionWithDynamicParams: (_, params: { msg: string }) => {
          actionWithDynamicParams(params);
        },
        stringAction
      }
    }).createMachine({
      entry: [
        { type: 'actionWithParams', params: { a: 1 } },
        'stringAction',
        assign({ count: 100 })
      ],
      context: { count: 0 },
      on: {
        event: {
          actions: {
            type: 'actionWithDynamicParams',
            params: ({ event }) => {
              return { msg: event.msg };
            }
          }
        }
      }
    });

    const [state0, actions0] = initialTransition(machine);

    expect(state0.context.count).toBe(100);
    expect(actions0).toEqual([
      expect.objectContaining({ type: 'actionWithParams', params: { a: 1 } }),
      expect.objectContaining({ type: 'stringAction' })
    ]);

    expect(actionWithParams).not.toHaveBeenCalled();
    expect(stringAction).not.toHaveBeenCalled();

    // Execute actions
    actions0.forEach((a) => machine.executeAction(a, {} as any));

    expect(actionWithParams).toHaveBeenCalledWith(expect.anything(), { a: 1 });
    expect(stringAction).toHaveBeenCalled();

    const [state1, actions1] = transition(machine, state0, {
      type: 'event',
      msg: 'hello'
    });

    expect(state1.context.count).toBe(100);
    expect(actions1).toEqual([
      expect.objectContaining({
        type: 'actionWithDynamicParams',
        params: { msg: 'hello' }
      })
    ]);

    expect(actionWithDynamicParams).not.toHaveBeenCalled();

    // Execute actions
    actions1.forEach((a) => machine.executeAction(a, {} as any));

    expect(actionWithDynamicParams).toHaveBeenCalledWith({
      msg: 'hello'
    });
  });

  it('should capture enqueued actions', () => {
    const machine = createMachine({
      entry: [
        enqueueActions((x) => {
          x.enqueue('stringAction');
          x.enqueue({ type: 'objectAction' });
        })
      ]
    });

    const [_state, actions] = initialTransition(machine);

    expect(actions).toEqual([
      expect.objectContaining({ type: 'stringAction' }),
      expect.objectContaining({ type: 'objectAction' })
    ]);
  });

  it('actor can be specified', () => {
    const machine = createMachine({
      entry: (x) => {
        x.self.send({ type: 'next' });
      },
      initial: 'a',
      states: {
        a: {
          on: { next: 'b' }
        },
        b: {}
      }
    });

    const [state, actions] = initialTransition(machine);

    const actor = createActor(machine, {
      snapshot: state
    }).start();

    expect(actor.getSnapshot().matches('a')).toBeTruthy();

    actions.forEach((action) => {
      machine.executeAction(action, actor);
    });

    expect(actor.getSnapshot().matches('b')).toBeTruthy();
  });

  it('Delayed raise actions should be returned', async () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          entry: raise({ type: 'NEXT' }, { delay: 10 }),
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

    const actor = createActor(machine, {
      snapshot: state
    }).start();

    actions.forEach((action) => {
      machine.executeAction(action, actor);
    });

    await waitFor(actor, (s) => s.matches('b'));
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
        type: 'xstate.raise',
        params: expect.objectContaining({
          delay: 10,
          event: { type: 'xstate.after.10.(machine).a' }
        })
      })
    );

    const actor = createActor(machine, {
      snapshot: state
    }).start();

    actions.forEach((action) => {
      machine.executeAction(action, actor);
    });

    await waitFor(actor, (s) => s.matches('b'));
  });

  // Copied from getSnapshot.test.ts

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
    const fn = jest.fn();

    const machine = createMachine({
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

    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            event: {
              target: 'b',
              actions: fn
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

    async function execute(action: ExecutableActionsFrom<typeof machine>) {
      if (action.type === 'xstate.raise' && action.params.delay) {
        const currentTime = Date.now();
        const startedAt = action.params.startedAt ?? currentTime;
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

    const machine = setup({
      actors: {
        sendWelcomeEmail: fromPromise(async () => {
          calls.push('sendWelcomeEmail');
          return {
            status: 'sent'
          };
        })
      }
    }).createMachine({
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
        case 'xstate.spawn': {
          const spawnAction = action as ExecutableSpawnAction;
          const logic = machine.implementations.actors[spawnAction.params.src];
          const output = await toPromise(
            createActor(logic as any, spawnAction.params).start()
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
