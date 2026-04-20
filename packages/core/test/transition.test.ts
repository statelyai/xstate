import { setTimeout as sleep } from 'node:timers/promises';
import {
  assign,
  cancel,
  createActor,
  createMachine,
  emit,
  enqueueActions,
  EventFrom,
  ExecutableActionsFrom,
  ExecutableSpawnAction,
  fromPromise,
  fromTransition,
  log,
  raise,
  sendTo,
  setup,
  toPromise,
  transition
} from '../src';
import { createDoneActorEvent } from '../src/eventUtils';
import { initialTransition, getNextTransitions } from '../src';
import assert from 'node:assert';
import { resolveReferencedActor } from '../src/utils';

describe('transition function', () => {
  it('should capture actions', () => {
    const actionWithParams = vi.fn();
    const actionWithDynamicParams = vi.fn();
    const stringAction = vi.fn();

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
  });

  it('should not execute a referenced serialized action', () => {
    const foo = vi.fn();

    const machine = setup({
      actions: {
        foo
      }
    }).createMachine({
      entry: 'foo',
      context: { count: 0 }
    });

    const [, actions] = initialTransition(machine);

    expect(foo).not.toHaveBeenCalled();
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

  it('delayed raise actions should be returned', async () => {
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
  });

  it('cancel action should be returned', async () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          entry: raise({ type: 'NEXT' }, { delay: 10, id: 'myRaise' }),
          on: {
            NEXT: {
              target: 'b',
              actions: cancel('myRaise')
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
    const machine = createMachine({
      initial: 'a',
      invoke: {
        src: createMachine({}),
        id: 'someActor'
      },
      states: {
        a: {
          on: {
            NEXT: {
              actions: sendTo('someActor', { type: 'someEvent' })
            }
          }
        }
      }
    });

    const [state, actions0] = initialTransition(machine);

    expect(state.value).toEqual('a');

    expect(actions0).toContainEqual(
      expect.objectContaining({
        type: 'xstate.spawnChild',
        params: expect.objectContaining({
          id: 'someActor'
        })
      })
    );

    const [, actions] = transition(machine, state, { type: 'NEXT' });

    expect(actions).toContainEqual(
      expect.objectContaining({
        type: 'xstate.sendTo',
        params: expect.objectContaining({
          targetId: 'someActor'
        })
      })
    );
  });

  it('emit actions should be returned', async () => {
    const machine = createMachine({
      initial: 'a',
      context: { count: 10 },
      states: {
        a: {
          on: {
            NEXT: {
              actions: emit(({ context }) => ({
                type: 'counted',
                count: context.count
              }))
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
        type: 'xstate.emit',
        params: expect.objectContaining({
          event: { type: 'counted', count: 10 }
        })
      })
    );
  });

  it('log actions should be returned', async () => {
    const machine = createMachine({
      initial: 'a',
      context: { count: 10 },
      states: {
        a: {
          on: {
            NEXT: {
              actions: log(({ context }) => `count: ${context.count}`)
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
    const fn = vi.fn();

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

describe('getNextTransitions', () => {
  it('should return all transitions from current state', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            GO_B: 'b',
            GO_C: 'c'
          }
        },
        b: {},
        c: {}
      }
    });

    const actor = createActor(machine);
    actor.start();
    const state = actor.getSnapshot();

    const transitions = getNextTransitions(state);

    expect(transitions).toHaveLength(2);
    // Order should be deterministic: transitions appear in the order they're defined
    expect(transitions.map((t) => t.eventType)).toEqual(['GO_B', 'GO_C']);
  });

  it('should include guarded transitions regardless of guard result', () => {
    const machine = createMachine({
      initial: 'a',
      context: { count: 100 },
      states: {
        a: {
          on: {
            GO_B: [
              {
                guard: ({ context }) => context.count < 10,
                target: 'b'
              },
              {
                target: 'd'
              }
            ],
            GO_C: {
              guard: ({ context }) => context.count > 50,
              target: 'c'
            }
          }
        },
        b: {},
        c: {},
        d: {}
      }
    });

    const actor = createActor(machine);
    actor.start();
    const state = actor.getSnapshot();

    const transitions = getNextTransitions(state);

    expect(transitions).toHaveLength(3);
    // Order should be deterministic: all GO_B transitions first (in order), then GO_C
    expect(transitions.map((t) => t.eventType)).toEqual([
      'GO_B',
      'GO_B',
      'GO_C'
    ]);
    // Verify targets match the order
    expect(transitions.map((t) => t.target?.[0]?.key)).toEqual(['b', 'd', 'c']);
  });

  it('should include always (eventless) transitions', () => {
    const machine = createMachine({
      initial: 'a',
      context: { count: 5 },
      states: {
        a: {
          always: [
            { guard: ({ context }) => context.count > 10, target: 'b' },
            { guard: () => false, target: 'c' }
          ],
          on: {
            GO_D: 'd'
          }
        },
        b: {},
        c: {},
        d: {}
      }
    });

    const actor = createActor(machine);
    actor.start();
    const state = actor.getSnapshot();

    const transitions = getNextTransitions(state);

    expect(transitions).toHaveLength(3);
    // Order: on transitions first, then always transitions (in order they appear)
    expect(transitions.map((t) => t.eventType)).toEqual(['GO_D', '', '']);
    expect(transitions.map((t) => t.target?.[0]?.key)).toEqual(['d', 'b', 'c']);
  });

  it('should include after (delayed) transitions', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          after: {
            1000: 'b'
          },
          on: {
            GO_C: 'c'
          }
        },
        b: {},
        c: {}
      }
    });

    const actor = createActor(machine);
    actor.start();
    const state = actor.getSnapshot();

    const transitions = getNextTransitions(state);

    expect(transitions).toHaveLength(2);
    // Order: on transitions first (in definition order), then after transitions
    expect(transitions.map((t) => t.eventType)).toEqual([
      'GO_C',
      'xstate.after.1000.(machine).a'
    ]);
    expect(transitions.map((t) => t.target?.[0]?.key)).toEqual(['c', 'b']);
  });

  it('should include transitions from parent states in depth-first order', () => {
    const machine = createMachine({
      initial: 'parent',
      states: {
        parent: {
          initial: 'child',
          on: {
            PARENT_EVENT: 'other'
          },
          states: {
            child: {
              on: {
                CHILD_EVENT: 'sibling'
              }
            },
            sibling: {}
          }
        },
        other: {}
      }
    });

    const actor = createActor(machine);
    actor.start();
    const state = actor.getSnapshot();

    const transitions = getNextTransitions(state);

    // Order: child state transitions first, then parent state transitions
    expect(transitions.map((t) => t.eventType)).toEqual([
      'CHILD_EVENT',
      'PARENT_EVENT'
    ]);
  });

  it('should include all guarded transitions from different state nodes with same event type', () => {
    const machine = createMachine({
      initial: 'parent',
      states: {
        parent: {
          initial: 'child',
          on: {
            SAME_EVENT: [
              {
                guard: () => false,
                target: 'parentTarget'
              },
              {
                target: 'parentTarget2'
              }
            ]
          },
          states: {
            child: {
              on: {
                SAME_EVENT: {
                  target: 'childTarget'
                }
              }
            },
            childTarget: {}
          }
        },
        parentTarget: {},
        parentTarget2: {}
      }
    });

    const actor = createActor(machine);
    actor.start();
    const state = actor.getSnapshot();

    const transitions = getNextTransitions(state);

    // Should include all transitions: 2 from parent, 1 from child = 3 total
    expect(transitions).toHaveLength(3);
    const sameEventTransitions = transitions.filter(
      (t) => t.eventType === 'SAME_EVENT'
    );
    expect(sameEventTransitions).toHaveLength(3);
    // Order: child state transitions first, then parent state transitions
    expect(sameEventTransitions[0].target?.[0]?.key).toBe('childTarget');
    expect(sameEventTransitions[1].target?.[0]?.key).toBe('parentTarget');
    expect(sameEventTransitions[2].target?.[0]?.key).toBe('parentTarget2');
  });

  it('should return transitions from parallel states in document order', () => {
    const machine = createMachine({
      type: 'parallel',
      states: {
        regionA: {
          initial: 'a1',
          on: {
            REGION_A_EVENT: '.a2'
          },
          states: {
            a1: {
              on: {
                A1_EVENT: 'a2'
              }
            },
            a2: {}
          }
        },
        regionB: {
          initial: 'b1',
          on: {
            REGION_B_EVENT: '.b2'
          },
          states: {
            b1: {
              on: {
                B1_EVENT: 'b2'
              }
            },
            b2: {}
          }
        }
      }
    });

    const actor = createActor(machine);
    actor.start();
    const state = actor.getSnapshot();

    const transitions = getNextTransitions(state);

    // Order: regionA atomic state first (depth-first), then regionB atomic state
    // Within each: child transitions first, then parent transitions
    expect(transitions.map((t) => t.eventType)).toEqual([
      'A1_EVENT', // regionA.a1 (atomic)
      'REGION_A_EVENT', // regionA (parent)
      'B1_EVENT', // regionB.b1 (atomic)
      'REGION_B_EVENT' // regionB (parent)
    ]);
  });

  it('should return transitions from deeply nested compound states in depth-first order', () => {
    const machine = createMachine({
      initial: 'level1',
      on: {
        ROOT_EVENT: '.level1'
      },
      states: {
        level1: {
          initial: 'level2',
          on: {
            LEVEL1_EVENT: '.level2'
          },
          states: {
            level2: {
              initial: 'level3',
              on: {
                LEVEL2_EVENT: '.level3'
              },
              states: {
                level3: {
                  on: {
                    LEVEL3_EVENT: 'level3'
                  }
                }
              }
            }
          }
        }
      }
    });

    const actor = createActor(machine);
    actor.start();
    const state = actor.getSnapshot();

    const transitions = getNextTransitions(state);

    // Order: deepest state first, then ancestors up to root
    expect(transitions.map((t) => t.eventType)).toEqual([
      'LEVEL3_EVENT', // level3 (atomic, deepest)
      'LEVEL2_EVENT', // level2 (parent of level3)
      'LEVEL1_EVENT', // level1 (grandparent)
      'ROOT_EVENT' // root (great-grandparent)
    ]);
  });

  it('should return transitions from parallel states with nested compound states', () => {
    const machine = createMachine({
      type: 'parallel',
      on: {
        ROOT_EVENT: {}
      },
      states: {
        regionA: {
          initial: 'nested',
          on: {
            REGION_A_EVENT: '.nested'
          },
          states: {
            nested: {
              initial: 'deep',
              on: {
                NESTED_A_EVENT: '.deep'
              },
              states: {
                deep: {
                  on: {
                    DEEP_A_EVENT: 'deep'
                  }
                }
              }
            }
          }
        },
        regionB: {
          initial: 'leaf',
          on: {
            REGION_B_EVENT: '.leaf'
          },
          states: {
            leaf: {
              on: {
                LEAF_B_EVENT: 'leaf'
              }
            }
          }
        }
      }
    });

    const actor = createActor(machine);
    actor.start();
    const state = actor.getSnapshot();

    const transitions = getNextTransitions(state);

    // Order: regionA's atomic state (depth-first up to regionA),
    // then regionB's atomic state (depth-first up to regionB),
    // then root
    expect(transitions.map((t) => t.eventType)).toEqual([
      'DEEP_A_EVENT', // regionA.nested.deep (atomic)
      'NESTED_A_EVENT', // regionA.nested
      'REGION_A_EVENT', // regionA
      'ROOT_EVENT', // root
      'LEAF_B_EVENT', // regionB.leaf (atomic)
      'REGION_B_EVENT' // regionB
    ]);
  });
});
