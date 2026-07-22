import { setTimeout as sleep } from 'node:timers/promises';
import {
  createMachine,
  EventFrom,
  createAsyncLogic,
  createLogic,
  createCallbackLogic,
  toPromise,
  transition,
  createActor,
  getInitialMicrosteps,
  getMicrosteps,
  getNextTransitions,
  isBuiltInExecutableAction
} from '../src';
import type {
  AnyActor,
  ExecutableActionObject,
  SpecialExecutableAction
} from '../src/types';
import { createDoneActorEvent } from '../src/eventUtils';
import { initialTransition } from '../src/transition';
import { listenerLogic } from '../src/actors/listener';
import { subscriptionLogic } from '../src/actors/subscription';
import { XSTATE_SPAWN, XSTATE_START, XSTATE_STOP } from '../src/constants';
import { z } from 'zod';

const isEffect =
  <T extends SpecialExecutableAction['type']>(type: T) =>
  (
    e: ExecutableActionObject
  ): e is Extract<SpecialExecutableAction, { type: T }> =>
    isBuiltInExecutableAction(e) && e.type === type;

function describeEffects(effects: ExecutableActionObject[]): string[] {
  // Classify each spawned actor exactly once, from its authored-position
  // `@xstate.spawn` effect (which carries `logic`/`input`; listener and
  // subscription actors carry their target actor ref in `input.actor`). Slim
  // `@xstate.start` effects then reuse the label via their `actor` ref.
  const labelByActor = new Map<any, string>();
  for (const e of effects) {
    if (!isBuiltInExecutableAction(e) || e.type !== XSTATE_SPAWN) {
      continue;
    }
    const input = e.input as { actor: { id: string } };
    const label =
      e.logic === listenerLogic
        ? `listen(${input.actor.id})`
        : e.logic === subscriptionLogic
          ? `subscribe(${input.actor.id})`
          : `spawn(${e.id})`;
    labelByActor.set(e.actor, label);
  }

  return effects.filter(isBuiltInExecutableAction).flatMap((e) => {
    switch (e.type) {
      case XSTATE_STOP:
        return `stop(${e.actor.id})`;
      case XSTATE_SPAWN:
        return labelByActor.get(e.actor)!;
      case XSTATE_START: {
        const label = labelByActor.get(e.actor);
        if (label) {
          return label.startsWith('spawn(')
            ? `start(${e.id})`
            : `start:${label}`;
        }
        // No spawn record in this effects array; classify attached actors by
        // logic identity (target id unknown), else a plain child start.
        // These casts are permanent: `logic` lives on the Actor class, not the
        // public `AnyActor` interface carried by the effect.
        if ((e.actor as any).logic === listenerLogic) {
          return `start:listen(${e.actor.id})`;
        }
        if ((e.actor as any).logic === subscriptionLogic) {
          return `start:subscribe(${e.actor.id})`;
        }
        return `start(${e.id})`;
      }
      default:
        return [];
    }
  });
}

describe('transition function', () => {
  it('resolves mapper context on object transitions', () => {
    const machine = createMachine({
      schemas: {
        context: z.object({
          value: z.number()
        }),
        events: {
          GO: z.object({
            value: z.number()
          })
        }
      },
      context: { value: 0 },
      initial: 'idle',
      states: {
        idle: {
          on: {
            GO: {
              target: 'done',
              context: ({ event }) => ({ value: event.value })
            }
          }
        },
        done: {
          type: 'final',
          output: ({ context }) => context.value
        }
      }
    });

    const actor = createActor(machine).start();

    actor.send({ type: 'GO', value: 42 });

    expect(actor.getSnapshot().context.value).toBe(42);
  });

  it('resolves mapper context on invoke onDone object transitions', async () => {
    const machine = createMachine({
      schemas: {
        context: z.object({
          value: z.number()
        })
      },
      context: { value: 0 },
      initial: 'pending',
      states: {
        pending: {
          invoke: {
            src: createAsyncLogic({
              run: async () => 42
            }),
            onDone: {
              target: 'done',
              context: ({ output }) => ({ value: output })
            }
          }
        },
        done: {
          type: 'final',
          output: ({ context }) => context.value
        }
      }
    });

    const actor = createActor(machine).start();

    await toPromise(actor);

    expect(actor.getSnapshot().context.value).toBe(42);
  });

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
            NEXT: { target: 'b' }
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
          after: { 10: { target: 'b' } }
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

  it('enq.raise with a string event throws in a transition function', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: (_, enq) => {
              enq.raise(
                // @ts-expect-error only event objects are allowed
                'a string'
              );
            }
          }
        }
      }
    });

    const [state] = initialTransition(machine);

    expect(() => transition(machine, state, { type: 'NEXT' })).toThrowError(
      'Only event objects may be used with raise; use raise({ type: "a string" }) instead'
    );
  });

  it('enq.sendTo with an undefined actor does not return a sendTo action from a transition function', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            NEXT: ({ children }, enq) => {
              enq.sendTo(children.missing, { type: 'someEvent' });
            }
          }
        }
      }
    });

    const [state] = initialTransition(machine);
    const [nextState, actions] = transition(machine, state, { type: 'NEXT' });

    expect(actions.some((a) => (a as any).type === '@xstate.sendTo')).toBe(
      false
    );
    expect(nextState.status).toBe('active');
  });

  it('enq.spawn creates and starts a child once from a transition function', () => {
    let childConstructions = 0;
    const childMachine = createMachine({
      schemas: {
        context: z.object({
          n: z.number()
        })
      },
      context: () => {
        childConstructions++;
        return { n: 0 };
      },
      on: {
        ping: ({ context }) => ({
          context: { n: context.n + 1 }
        })
      }
    });

    const parentMachine = createMachine({
      on: {
        SPAWN: (_, enq) => {
          enq.spawn(childMachine, { registryKey: 'child' });
        }
      }
    });

    const actor = createActor(parentMachine).start();

    expect(() => actor.send({ type: 'SPAWN' })).not.toThrow();
    expect(childConstructions).toBe(1);

    const child = actor.system.get('child')!;
    child.send({ type: 'ping' });

    expect(child.getSnapshot().context).toEqual({ n: 1 });
  });

  it('keeps one child ref before and after its spawn effect executes', () => {
    const childLogic = createCallbackLogic(() => {});
    const machine = createMachine({
      entry: (_, enq) => {
        enq.spawn(childLogic, { id: 'child', registryKey: 'child' });
      }
    });
    const actor = createActor(machine);
    const child = actor.getSnapshot().children.child;

    expect(actor.system.get('child')).toBe(child);

    actor.start();

    expect(actor.getSnapshot().children.child).toBe(child);
    expect(actor.system.get('child')).toBe(child);
    expect(child.getSnapshot().status).toBe('active');
  });

  it('uses the snapshot child ref as self after start', () => {
    let entrySelf: AnyActor | undefined;
    let transitionSelf: AnyActor | undefined;
    const childLogic = createMachine({
      entry: ({ self }, enq) => enq(() => (entrySelf = self)),
      on: {
        PING: ({ self }, enq) => enq(() => (transitionSelf = self))
      }
    });
    const machine = createMachine({
      invoke: { id: 'child', src: childLogic }
    });
    const actor = createActor(machine).start();
    const child = actor.getSnapshot().children.child;

    child.send({ type: 'PING' });

    expect(entrySelf).toBe(child);
    expect(transitionSelf).toBe(child);
  });

  it('uses the same system on child self during initialization', () => {
    let usesTransitionSystem = false;
    const childLogic = createMachine({
      entry: ({ self, system }, enq) =>
        enq(() => {
          usesTransitionSystem = self.system === system;
        })
    });
    const machine = createMachine({
      invoke: { id: 'child', src: childLogic }
    });

    createActor(machine).start();

    expect(usesTransitionSystem).toBe(true);
  });

  it('uses the same system on a runtime self', () => {
    let usesRuntimeSystem = false;
    const machine = createMachine({
      entry: ({ self, system }, enq) =>
        enq(() => {
          usesRuntimeSystem = self.system === system;
        })
    });

    createActor(machine).start();

    expect(usesRuntimeSystem).toBe(true);
  });

  it('built-in action effects expose public metadata fields', () => {
    const childMachine = createMachine({});
    const machine = createMachine({
      initial: 'a',
      invoke: {
        src: childMachine,
        id: 'child',
        input: () => ({ kind: 'invoke' })
      },
      states: {
        a: {
          on: {
            NEXT: ({ children }, enq) => {
              enq.spawn(childMachine, {
                id: 'spawned',
                input: { kind: 'spawn' }
              });
              enq.raise({ type: 'later' }, { id: 'raise-id', delay: 10 });
              enq.sendTo(
                children.child,
                { type: 'ping' },
                { id: 'send-id', delay: 20 }
              );
              enq.cancel('raise-id');
              enq.stop(children.child);
            }
          }
        }
      }
    });

    const [state, initialActions] = initialTransition(machine);

    // Full metadata now lives on the authored-position `@xstate.spawn` effect.
    const invokeSpawn = initialActions.find(isEffect(XSTATE_SPAWN))!;

    expect(invokeSpawn).toBeDefined();
    expect(invokeSpawn.actor).toBe(invokeSpawn.args[0]);
    expect(invokeSpawn.id).toBe('child');
    expect(invokeSpawn.logic).toBe(childMachine);
    expect(invokeSpawn.src).toBe(invokeSpawn.actor.src);
    expect(invokeSpawn.input).toEqual({ kind: 'invoke' });

    // The deferred `@xstate.start` effect is slimmed to `{ actor, id }`.
    const invokeStart = initialActions.find(isEffect(XSTATE_START))!;

    expect(invokeStart.type).toBe('@xstate.start');
    expect(invokeStart.actor).toBe(invokeStart.args[0]);
    expect(invokeStart.id).toBe('child');

    const [, actions] = transition(machine, state, { type: 'NEXT' });

    const spawnedSpawn = actions
      .filter(isEffect(XSTATE_SPAWN))
      .find((action) => action.id === 'spawned')!;
    expect(spawnedSpawn).toBeDefined();
    expect(spawnedSpawn.id).toBe('spawned');
    expect(spawnedSpawn.actor).toBe(spawnedSpawn.args[0]);
    expect(spawnedSpawn.logic).toBe(childMachine);
    expect(spawnedSpawn.src).toBe(childMachine);
    expect(spawnedSpawn.input).toEqual({ kind: 'spawn' });

    const spawnedStart = actions
      .filter(isEffect(XSTATE_START))
      .find((action) => action.id === 'spawned')!;
    expect(spawnedStart.type).toBe('@xstate.start');
    expect(spawnedStart.id).toBe('spawned');
    expect(spawnedStart.actor).toBe(spawnedStart.args[0]);

    expect(
      actions.find((action) => action.type === '@xstate.raise')
    ).toMatchObject({
      type: '@xstate.raise',
      event: { type: 'later' },
      id: 'raise-id',
      delay: 10
    });

    const sendAction = actions.find(isEffect('@xstate.sendTo'))!;
    expect(sendAction).toMatchObject({
      type: '@xstate.sendTo',
      event: { type: 'ping' },
      id: 'send-id',
      delay: 20
    });
    expect(sendAction.target).toBe(state.children.child);

    expect(
      actions.find((action) => action.type === '@xstate.cancel')
    ).toMatchObject({
      type: '@xstate.cancel',
      id: 'raise-id'
    });

    const stopAction = actions.find(isEffect(XSTATE_STOP))!;
    expect(stopAction.type).toBe('@xstate.stop');
    expect(stopAction.actor).toBe(state.children.child);
    expect(stopAction.id).toBe('child');
  });

  describe('invoke stop effects', () => {
    const listener = createCallbackLogic(() => {});

    it('returns an @xstate.stop effect when an invoking state exits', () => {
      const machine = createMachine({
        id: 'player',
        initial: 'mini',
        states: {
          mini: { on: { toggle: { target: 'full' } } },
          full: {
            invoke: { id: 'keyEscape', src: listener },
            on: { 'key.escape': { target: 'mini' } }
          }
        }
      });

      const [initial] = initialTransition(machine);
      const [full] = transition(machine, initial, { type: 'toggle' });
      const child = full.children.keyEscape;
      const [mini, effects] = transition(machine, full, {
        type: 'key.escape'
      });

      expect(mini.children).toEqual({});
      expect(effects.filter(isEffect(XSTATE_STOP))).toEqual([
        expect.objectContaining({
          type: XSTATE_STOP,
          actor: child,
          id: 'keyEscape',
          args: [expect.anything(), child]
        })
      ]);
    });

    it('orders an invoke stop after its exit action', () => {
      function exitAction() {}
      const machine = createMachine({
        initial: 'active',
        states: {
          active: {
            invoke: { id: 'child', src: listener },
            exit: (_, enq) => enq(exitAction),
            on: { EXIT: { target: 'inactive' } }
          },
          inactive: {}
        }
      });

      const [active] = initialTransition(machine);
      const [, effects] = transition(machine, active, { type: 'EXIT' });

      expect(effects.map((effect) => effect.type)).toEqual([
        'exitAction',
        XSTATE_STOP
      ]);
    });

    it('preserves one-argument exit actions before an invoke stop', () => {
      function exitAction(_: unknown) {}
      const machine = createMachine({
        initial: 'active',
        states: {
          active: {
            invoke: { id: 'child', src: listener },
            exit: exitAction,
            on: { EXIT: { target: 'inactive' } }
          },
          inactive: {}
        }
      });

      const [active] = initialTransition(machine);
      const [, effects] = transition(machine, active, { type: 'EXIT' });

      expect(effects).toHaveLength(2);
      expect(effects[0].type).not.toBe(XSTATE_STOP);
      expect(effects[1]).toMatchObject({ type: XSTATE_STOP, id: 'child' });
    });

    it('orders after cancellation before the invoke stop', () => {
      const machine = createMachine({
        initial: 'active',
        states: {
          active: {
            invoke: { id: 'child', src: listener },
            after: { 1000: { target: 'inactive' } },
            on: { EXIT: { target: 'inactive' } }
          },
          inactive: {}
        }
      });

      const [active] = initialTransition(machine);
      const [, effects] = transition(machine, active, { type: 'EXIT' });
      const lifecycleEffects = effects.filter(
        (effect) =>
          effect.type === '@xstate.cancel' || effect.type === XSTATE_STOP
      );

      expect(lifecycleEffects).toEqual([
        expect.objectContaining({
          type: '@xstate.cancel',
          id: 'xstate.after.1000.(machine).active'
        }),
        expect.objectContaining({ type: XSTATE_STOP, id: 'child' })
      ]);
    });

    it('stops invokes in reverse state document order on parallel exit', () => {
      const machine = createMachine({
        initial: 'active',
        states: {
          active: {
            type: 'parallel',
            on: { EXIT: { target: 'inactive' } },
            states: {
              left: { invoke: { id: 'left', src: listener } },
              right: { invoke: { id: 'right', src: listener } }
            }
          },
          inactive: {}
        }
      });

      const [active] = initialTransition(machine);
      const [, effects] = transition(machine, active, { type: 'EXIT' });

      expect(
        effects.filter(isEffect(XSTATE_STOP)).map((effect) => effect.id)
      ).toEqual(['right', 'left']);
    });

    it('stops multiple invokes in their declaration order', () => {
      const machine = createMachine({
        initial: 'active',
        states: {
          active: {
            invoke: [
              { id: 'first', src: listener },
              { id: 'second', src: listener }
            ],
            on: { EXIT: { target: 'inactive' } }
          },
          inactive: {}
        }
      });

      const [active] = initialTransition(machine);
      const [, effects] = transition(machine, active, { type: 'EXIT' });

      expect(
        effects.filter(isEffect(XSTATE_STOP)).map((effect) => effect.id)
      ).toEqual(['first', 'second']);
    });

    it('stops nested invokes from child state to parent state', () => {
      const machine = createMachine({
        initial: 'active',
        states: {
          active: {
            invoke: { id: 'parent', src: listener },
            initial: 'child',
            states: {
              child: { invoke: { id: 'child', src: listener } }
            },
            on: { EXIT: { target: 'inactive' } }
          },
          inactive: {}
        }
      });

      const [active] = initialTransition(machine);
      const [, effects] = transition(machine, active, { type: 'EXIT' });

      expect(
        effects.filter(isEffect(XSTATE_STOP)).map((effect) => effect.id)
      ).toEqual(['child', 'parent']);
    });

    it('stops remaining children when the machine reaches a final state', () => {
      const machine = createMachine({
        invoke: { id: 'rootChild', src: listener },
        initial: 'active',
        states: {
          active: { on: { FINISH: { target: 'done' } } },
          done: { type: 'final' }
        }
      });

      const [active] = initialTransition(machine);
      const [done, effects] = transition(machine, active, { type: 'FINISH' });

      expect(done.status).toBe('done');
      expect(done.children).toEqual({});
      expect(
        effects.filter(isEffect(XSTATE_STOP)).map((effect) => effect.id)
      ).toEqual(['rootChild']);
    });

    it('stops spawned children after root exit actions on machine completion', () => {
      const order: string[] = [];
      const child = createCallbackLogic(() => () => order.push('stop'));
      const machine = createMachine({
        entry: (_, enq) => enq.spawn(child, { id: 'child' }),
        exit: (_, enq) => enq(() => order.push('exit')),
        initial: 'active',
        states: {
          active: { on: { FINISH: { target: 'done' } } },
          done: { type: 'final' }
        }
      });
      const actor = createActor(machine).start();

      actor.send({ type: 'FINISH' });

      expect(order).toEqual(['exit', 'stop']);
    });

    it('reports every removed child id with a stop effect', () => {
      const machine = createMachine({
        initial: 'first',
        states: {
          first: {
            invoke: { id: 'firstChild', src: listener },
            on: { NEXT: { target: 'second' } }
          },
          second: {
            invoke: { id: 'secondChild', src: listener },
            on: { FINISH: { target: 'done' } }
          },
          done: { type: 'final' }
        }
      });

      const [first] = initialTransition(machine);
      const [second, nextEffects] = transition(machine, first, {
        type: 'NEXT'
      });
      const [done, finishEffects] = transition(machine, second, {
        type: 'FINISH'
      });

      for (const [previous, next, effects] of [
        [first, second, nextEffects],
        [second, done, finishEffects]
      ] as const) {
        const removedIds = Object.keys(previous.children).filter(
          (id) => !(id in next.children)
        );
        const stoppedIds = effects
          .filter(isEffect(XSTATE_STOP))
          .map((effect) => effect.id);

        expect(stoppedIds).toEqual(removedIds);
      }
    });

    it('exposes stops in getMicrosteps and getInitialMicrosteps', () => {
      const machine = createMachine({
        initial: 'active',
        states: {
          active: {
            invoke: { id: 'child', src: listener },
            on: { EXIT: { target: 'inactive' } }
          },
          inactive: {}
        }
      });
      const [active] = initialTransition(machine);
      const microsteps = getMicrosteps(machine, active, { type: 'EXIT' });
      const [, transitionEffects] = transition(machine, active, {
        type: 'EXIT'
      });

      expect(microsteps).toHaveLength(1);
      expect(
        microsteps[0][1]
          .filter(isEffect(XSTATE_STOP))
          .map((effect) => effect.id)
      ).toEqual(
        transitionEffects
          .filter(isEffect(XSTATE_STOP))
          .map((effect) => effect.id)
      );

      const initialMachine = createMachine({
        initial: 'transient',
        states: {
          transient: {
            invoke: { id: 'initialChild', src: listener },
            always: { target: 'settled' }
          },
          settled: {}
        }
      });
      const initialMicrosteps = getInitialMicrosteps(initialMachine);
      const [, initialEffects] = initialTransition(initialMachine);

      expect(initialMicrosteps).toHaveLength(2);
      expect(
        initialMicrosteps[1][1]
          .filter(isEffect(XSTATE_STOP))
          .map((effect) => effect.id)
      ).toEqual(
        initialEffects.filter(isEffect(XSTATE_STOP)).map((effect) => effect.id)
      );
    });

    it('createActor executes an invoke stop exactly once after exit actions', () => {
      const order: string[] = [];
      const dispose = vi.fn(() => order.push('stop'));
      const childLogic = createCallbackLogic(() => dispose);
      const machine = createMachine({
        initial: 'active',
        states: {
          active: {
            invoke: { id: 'child', src: childLogic },
            exit: (_, enq) => enq(() => order.push('exit')),
            on: { EXIT: { target: 'inactive' } }
          },
          inactive: {}
        }
      });
      const actor = createActor(machine).start();

      actor.send({ type: 'EXIT' });

      expect(order).toEqual(['exit', 'stop']);
      expect(dispose).toHaveBeenCalledTimes(1);
    });

    it('does not let an actor stop itself through enq.stop()', () => {
      const error = vi.fn();
      const machine = createMachine({
        on: {
          STOP_SELF: ({ self }, enq) => enq.stop(self)
        }
      });
      const actor = createActor(machine);
      actor.subscribe({ error });
      actor.start();

      actor.send({ type: 'STOP_SELF' });

      expect(error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('because it is not a child')
        })
      );
    });

    it('explicit enq.stop removes and stops a child exactly once', () => {
      const dispose = vi.fn();
      const childLogic = createCallbackLogic(() => dispose);
      const machine = createMachine({
        entry: (_, enq) => enq.spawn(childLogic, { id: 'child' }),
        on: {
          STOP: ({ children }, enq) => enq.stop(children.child)
        }
      });
      const [active, initialEffects] = initialTransition(machine);
      initialEffects.forEach((effect) => void effect.exec());
      const child = active.children.child;

      const [stopped, effects] = transition(machine, active, { type: 'STOP' });

      expect(stopped.children).toEqual({});
      expect(effects.filter(isEffect(XSTATE_STOP))).toEqual([
        expect.objectContaining({ actor: child, id: 'child' })
      ]);
      effects.forEach((effect) => void effect.exec());
      expect(dispose).toHaveBeenCalledOnce();
    });

    it('does not duplicate invoke auto-stop after an explicit exit stop', () => {
      const dispose = vi.fn();
      const machine = createMachine({
        initial: 'active',
        states: {
          active: {
            invoke: {
              id: 'child',
              src: createCallbackLogic(() => dispose)
            },
            exit: ({ children }, enq) => enq.stop(children.child),
            on: { EXIT: { target: 'inactive' } }
          },
          inactive: {}
        }
      });
      const actor = createActor(machine).start();

      actor.send({ type: 'EXIT' });

      expect(dispose).toHaveBeenCalledOnce();

      const [active] = initialTransition(machine);
      const [, effects] = transition(machine, active, { type: 'EXIT' });
      expect(effects.filter(isEffect(XSTATE_STOP))).toHaveLength(1);
    });

    it('supports naive sequential execution of invoke lifecycle effects', () => {
      const dispose = vi.fn();
      const childLogic = createCallbackLogic(() => dispose);
      const machine = createMachine({
        initial: 'active',
        states: {
          active: {
            invoke: { id: 'child', src: childLogic },
            on: { RESTART: { target: 'active', reenter: true } }
          }
        }
      });

      const [active, initialEffects] = initialTransition(machine);
      for (const effect of initialEffects) {
        void effect.exec();
      }

      const child = active.children.child;
      expect(child.getSnapshot().status).toBe('active');

      const [reentered, restartEffects] = transition(machine, active, {
        type: 'RESTART'
      });
      expect(describeEffects(restartEffects)).toEqual([
        'stop(child)',
        'spawn(child)',
        'start(child)'
      ]);
      for (const effect of restartEffects) {
        void effect.exec();
      }

      expect(child.getSnapshot().status).toBe('stopped');
      expect(reentered.children.child.getSnapshot().status).toBe('active');
      expect(dispose).toHaveBeenCalledTimes(1);
    });

    it('executes immediate sends in a sequential effect loop', () => {
      const received = vi.fn();
      const machine = createMachine({
        invoke: {
          id: 'child',
          src: createCallbackLogic(({ receive }) => receive(received))
        },
        on: {
          SEND: ({ children }, enq) =>
            enq.sendTo(children.child, { type: 'PING' })
        }
      });
      const [active, initialEffects] = initialTransition(machine);
      initialEffects.forEach((effect) => void effect.exec());

      const [, effects] = transition(machine, active, { type: 'SEND' });
      effects.forEach((effect: ExecutableActionObject) => void effect.exec());

      expect(received).toHaveBeenCalledWith({ type: 'PING' });
    });

    it('cancels a previously scheduled effect in a sequential effect loop', () => {
      const machine = createMachine({
        initial: 'waiting',
        states: {
          waiting: {
            after: { 10_000: { target: 'done' } },
            on: { CANCEL: { target: 'done' } }
          },
          done: {}
        }
      });
      const [waiting, initialEffects] = initialTransition(machine);
      initialEffects.forEach((effect) => void effect.exec());
      const source = initialEffects.find(isEffect('@xstate.raise'))!.source;

      expect(
        Object.keys(source.system.getSnapshot()._scheduledTimers)
      ).toHaveLength(1);

      const [, effects] = machine.transition(waiting, { type: 'CANCEL' });
      effects.forEach((effect: ExecutableActionObject) => void effect.exec());

      expect(
        Object.keys(source.system.getSnapshot()._scheduledTimers)
      ).toHaveLength(0);
    });

    it('machine transition methods do not require an actor scope', () => {
      const machine = createMachine({
        initial: 'a',
        states: {
          a: { on: { NEXT: { target: 'b' } } },
          b: {}
        }
      });

      const [a] = machine.initialTransition(undefined);
      const [b] = machine.transition(a, { type: 'NEXT' });

      expect(b.value).toBe('b');
    });

    it('keeps the inert self snapshot in sync for executable effects', () => {
      let effectSnapshot: unknown;
      const machine = createMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              NEXT: ({ self }, enq) => {
                enq(() => {
                  effectSnapshot = self.getSnapshot().value;
                });
                return { target: 'b' };
              }
            }
          },
          b: {}
        }
      });

      const [a] = machine.initialTransition(undefined);
      const [, effects] = machine.transition(a, { type: 'NEXT' });
      effects.forEach((effect: ExecutableActionObject) => void effect.exec());

      expect(effectSnapshot).toBe('b');
    });

    it('keeps executable effect self snapshots isolated between branches', () => {
      let effectSnapshot: unknown;
      const machine = createMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              LEFT: ({ self }, enq) => {
                enq(() => {
                  effectSnapshot = self.getSnapshot().value;
                });
                return { target: 'left' };
              },
              RIGHT: { target: 'right' }
            }
          },
          left: {},
          right: {}
        }
      });

      const [a] = machine.initialTransition(undefined);
      const [, leftEffects] = machine.transition(a, { type: 'LEFT' });
      machine.transition(a, { type: 'RIGHT' });
      leftEffects.forEach(
        (effect: ExecutableActionObject) => void effect.exec()
      );

      expect(effectSnapshot).toBe('left');
    });

    it('keeps pure system registries isolated between branches', () => {
      let branchSawChild = false;
      const child = createMachine({});
      const machine = createMachine({
        on: {
          SPAWN: (_, enq) => {
            enq.spawn(child, { registryKey: 'child' });
          },
          CHECK: ({ system }) => {
            branchSawChild = !!system.get('child');
          }
        }
      });

      const [initial] = machine.initialTransition(undefined);
      machine.transition(initial, { type: 'UNKNOWN' });
      machine.transition(initial, { type: 'SPAWN' });
      machine.transition(initial, { type: 'CHECK' });

      expect(branchSawChild).toBe(false);
    });

    it('does not expose future runtime registry entries to old snapshots', () => {
      let oldSnapshotSawChild = false;
      const child = createMachine({});
      const machine = createMachine({
        on: {
          SPAWN: (_, enq) => {
            enq.spawn(child, { registryKey: 'child' });
          },
          CHECK: ({ system }) => {
            oldSnapshotSawChild = !!system.get('child');
          }
        }
      });
      const actor = createActor(machine).start();
      const oldSnapshot = actor.getSnapshot();

      actor.send({ type: 'SPAWN' });
      transition(machine, oldSnapshot, { type: 'CHECK' });

      expect(actor.system.get('child')).toBeDefined();
      expect(oldSnapshotSawChild).toBe(false);
    });

    it('does not discover future nested actors through old child refs', () => {
      let oldSnapshotSawGrandchild = false;
      const child = createMachine({
        on: {
          SPAWN: (_, enq) => {
            enq.spawn(createMachine({}), { registryKey: 'grandchild' });
          }
        }
      });
      const machine = createMachine({
        invoke: { id: 'child', src: child },
        on: {
          CHECK: ({ system }) => {
            oldSnapshotSawGrandchild = !!system.get('grandchild');
          }
        }
      });
      const actor = createActor(machine).start();
      const oldSnapshot = actor.getSnapshot();

      oldSnapshot.children.child.send({ type: 'SPAWN' });
      transition(machine, oldSnapshot, { type: 'CHECK' });

      expect(oldSnapshotSawGrandchild).toBe(false);
    });

    it('removes stopped children from later pure system views', () => {
      let sawStoppedChild = true;
      const machine = createMachine({
        initial: 'active',
        states: {
          active: {
            invoke: {
              id: 'child',
              src: createMachine({}),
              registryKey: 'child'
            },
            on: { EXIT: { target: 'inactive' } }
          },
          inactive: {
            on: {
              CHECK: ({ system }) => {
                sawStoppedChild = !!system.get('child');
              }
            }
          }
        }
      });
      const [active] = initialTransition(machine);
      const [inactive] = transition(machine, active, { type: 'EXIT' });

      transition(machine, inactive, { type: 'CHECK' });

      expect(sawStoppedChild).toBe(false);
    });

    it('keeps actor session ids monotonic across pure stop and reentry', () => {
      const machine = createMachine({
        initial: 'active',
        states: {
          active: {
            invoke: { id: 'child', src: listener },
            on: { EXIT: { target: 'inactive' } }
          },
          inactive: { on: { ENTER: { target: 'active' } } }
        }
      });
      const [active] = initialTransition(machine);
      const firstSessionId = active.children.child.sessionId;
      const [inactive] = transition(machine, active, { type: 'EXIT' });
      const [reentered] = transition(machine, inactive, { type: 'ENTER' });

      expect(firstSessionId).toBe('x:1');
      expect(reentered.children.child.sessionId).toBe('x:2');
    });

    it('projects nested system registries from the input snapshot', () => {
      let foundGrandchild: AnyActor | undefined;
      const child = createMachine({
        invoke: {
          id: 'grandchild',
          src: createMachine({}),
          registryKey: 'grandchild'
        }
      });
      const machine = createMachine({
        invoke: { id: 'child', src: child },
        on: {
          CHECK: ({ system }) => {
            foundGrandchild = system.get('grandchild');
          }
        }
      });

      const [initial] = machine.initialTransition(undefined);
      const grandchild = initial.children.child.getSnapshot().children
        .grandchild as AnyActor;
      machine.transition(initial, { type: 'CHECK' });

      expect(foundGrandchild).toBe(grandchild);
    });

    it('preserves parent refs when purely transitioning a child snapshot', () => {
      let seenParent: unknown;
      const child = createMachine({
        on: {
          CHECK: ({ parent }, enq) => enq(() => (seenParent = parent))
        }
      });
      const parent = createActor(
        createMachine({ invoke: { id: 'child', src: child } })
      ).start();
      const childSnapshot = parent.getSnapshot().children.child.getSnapshot();

      const [, effects] = transition(child, childSnapshot, { type: 'CHECK' });
      effects.forEach((effect) => void effect.exec());

      expect(seenParent).toBe(parent);
    });

    it('does not reuse a running actor scope for a pure transition', () => {
      const machine = createMachine({
        initial: 'a',
        states: {
          a: { on: { NEXT: { target: 'b' } } },
          b: {}
        }
      });
      const actor = createActor(machine).start();

      const [next] = transition(machine, actor.getSnapshot(), {
        type: 'NEXT'
      });

      expect(next.value).toBe('b');
      expect(actor.getSnapshot().value).toBe('a');
    });

    it('appends deferred starts to the final microstep', () => {
      const machine = createMachine({
        entry: (_, enq) => enq.spawn(listener, { id: 'child' })
      });

      const microsteps = getInitialMicrosteps(machine);
      const effects = microsteps.flatMap(([, stepEffects]) => stepEffects);

      expect(describeEffects(effects)).toEqual([
        'spawn(child)',
        'start(child)'
      ]);
    });

    it('represents context initializer spawns as executable effects', () => {
      const started = vi.fn();
      const child = createCallbackLogic(() => {
        started();
      });
      const machine = createMachine({
        context: ({ spawn }) => ({
          child: spawn(child, { id: 'child' })
        })
      });

      const [snapshot, effects] = initialTransition(machine);

      expect(started).not.toHaveBeenCalled();
      expect(describeEffects(effects)).toEqual([
        'spawn(child)',
        'start(child)'
      ]);
      effects.forEach((effect) => void effect.exec());
      expect(snapshot.children.child.getSnapshot().status).toBe('active');
      expect(started).toHaveBeenCalledOnce();
    });
  });

  const emittingLogic = createCallbackLogic(({ emit }) => {
    emit({ type: 'someEvent' });
  });

  const completingLogic = createLogic({
    context: undefined,
    run: () => ({
      status: 'done',
      output: { result: 'success' }
    })
  });

  it('initialTransition: defers listener/child starts to the end of the effects', () => {
    const machine = createMachine({
      entry: (_, enq) => {
        const child = enq.spawn(emittingLogic, { id: 'child' });
        enq.listen(child, 'someEvent', () => ({ type: 'HEARD' }));
      }
    });

    const [, effects] = initialTransition(machine);

    expect(describeEffects(effects)).toEqual([
      'spawn(child)',
      'listen(child)',
      'start:listen(child)',
      'start(child)'
    ]);
  });

  it('initialTransition: defers subscription/child starts to the end of the effects', () => {
    const machine = createMachine({
      entry: (_, enq) => {
        const child = enq.spawn(completingLogic, { id: 'child' });
        enq.subscribeTo(child, {
          done: (output) => ({ type: 'CHILD_DONE', output })
        });
      }
    });

    const [, effects] = initialTransition(machine);

    expect(describeEffects(effects)).toEqual([
      'spawn(child)',
      'subscribe(child)',
      'start:subscribe(child)',
      'start(child)'
    ]);
  });

  it('transition: cross-phase spawns with listeners from exit and entry defer starts to the end of the effects', () => {
    const machine = createMachine({
      initial: 'a',
      context: {} as { spawnedOnExit: any },
      states: {
        a: {
          on: {
            GO: { target: 'b' }
          },
          exit: (_, enq) => {
            const spawnedOnExit = enq.spawn(emittingLogic, {
              id: 'exitChild'
            });
            enq.listen(spawnedOnExit, 'someEvent', () => ({ type: 'HEARD' }));
            return { context: { spawnedOnExit } };
          }
        },
        b: {
          entry: ({ context }, enq) => {
            const spawnedOnEntry = enq.spawn(emittingLogic, {
              id: 'entryChild'
            });
            enq.listen(spawnedOnEntry, 'someEvent', () => ({ type: 'HEARD' }));
            enq.listen(context.spawnedOnExit, 'someEvent', () => ({
              type: 'HEARD'
            }));
          }
        }
      }
    });

    const [state] = initialTransition(machine);
    const [, effects] = transition(machine, state, { type: 'GO' });

    expect(describeEffects(effects)).toEqual([
      // authored-position records across both microsteps
      'spawn(exitChild)',
      'listen(exitChild)',
      'spawn(entryChild)',
      'listen(entryChild)',
      'listen(exitChild)',
      // appended attached-actor starts (authored order)
      'start:listen(exitChild)',
      'start:listen(entryChild)',
      'start:listen(exitChild)',
      // appended child starts (authored order)
      'start(exitChild)',
      'start(entryChild)'
    ]);
  });

  it('transition: a same-transition spawn+stop keeps its appended start (which no-ops at runtime)', () => {
    const machine = createMachine({
      initial: 'a',
      context: {} as { spawnedChild: any },
      states: {
        a: {
          on: {
            GO: { target: 'b' }
          },
          exit: (_, enq) => {
            const spawnedChild = enq.spawn(emittingLogic, { id: 'child' });
            enq.stop(spawnedChild);
            return { context: { spawnedChild } };
          }
        },
        b: {
          entry: ({ context }, enq) => {
            enq.listen(context.spawnedChild, 'someEvent', () => ({
              type: 'HEARD'
            }));
          }
        }
      }
    });

    const [state] = initialTransition(machine);
    const [, effects] = transition(machine, state, { type: 'GO' });

    expect(describeEffects(effects)).toEqual([
      'spawn(child)',
      'stop(child)',
      'listen(child)',
      'start:listen(child)',
      // still present; no-ops at runtime because the child was already stopped
      'start(child)'
    ]);
  });

  it('transition: interleaved spawns and listeners in the same phase defer starts to the end (attached before child, each in authored order)', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            GO: { target: 'b' }
          }
        },
        b: {
          entry: (_, enq) => {
            const actorA = enq.spawn(emittingLogic, { id: 'actorA' });
            const actorB = enq.spawn(emittingLogic, { id: 'actorB' });
            enq.listen(actorB, 'someEvent', () => ({ type: 'HEARD_B' }));
            enq.listen(actorA, 'someEvent', () => ({ type: 'HEARD_A' }));
          }
        }
      }
    });

    const [state] = initialTransition(machine);
    const [, effects] = transition(machine, state, { type: 'GO' });

    expect(describeEffects(effects)).toEqual([
      'spawn(actorA)',
      'spawn(actorB)',
      'listen(actorB)',
      'listen(actorA)',
      // attached starts keep authored order (B then A)
      'start:listen(actorB)',
      'start:listen(actorA)',
      // child starts keep authored order (A then B)
      'start(actorA)',
      'start(actorB)'
    ]);
  });

  it('transition: listening to a pre-existing actor spawns+starts only the listener actor (no new target start)', () => {
    const machine = createMachine({
      initial: 'a',
      context: {} as { existingChild: any },
      states: {
        a: {
          entry: (_, enq) => {
            const existingChild = enq.spawn(emittingLogic, {
              id: 'existing'
            });
            return { context: { existingChild } };
          },
          on: {
            GO: { target: 'b' }
          }
        },
        b: {
          entry: ({ context }, enq) => {
            enq.listen(context.existingChild, 'someEvent', () => ({
              type: 'HEARD'
            }));
          }
        }
      }
    });

    const [state] = initialTransition(machine);
    const [, effects] = transition(machine, state, { type: 'GO' });

    expect(describeEffects(effects)).toEqual([
      'listen(existing)',
      'start:listen(existing)'
    ]);
  });

  it('initialTransition: spawn+listen+subscribeTo on the same child defers starts to the end', () => {
    const machine = createMachine({
      entry: (_, enq) => {
        const child = enq.spawn(completingLogic, { id: 'child' });
        enq.listen(child, 'someEvent', () => ({ type: 'HEARD' }));
        enq.subscribeTo(child, {
          done: (output) => ({ type: 'CHILD_DONE', output })
        });
      }
    });

    const [, effects] = initialTransition(machine);

    expect(describeEffects(effects)).toEqual([
      'spawn(child)',
      'listen(child)',
      'subscribe(child)',
      // attached-actor starts first, in authored order
      'start:listen(child)',
      'start:subscribe(child)',
      // child start last
      'start(child)'
    ]);
  });

  it('initialTransition: invoke start is deferred to the end, after entry actions', () => {
    const machine = createMachine({
      invoke: {
        id: 'child',
        src: emittingLogic
      },
      entry: ({ children }, enq) => {
        enq.listen(children.child!, 'someEvent', () => ({ type: 'HEARD' }));
      }
    });

    const [, effects] = initialTransition(machine);

    expect(describeEffects(effects)).toEqual([
      'spawn(child)',
      'listen(child)',
      'start:listen(child)',
      'start(child)'
    ]);
  });

  it('initialTransition: effects can be executed by a manual executor loop with listener starting before child', () => {
    const childLogic = createCallbackLogic(() => {});

    const machine = createMachine({
      entry: (_, enq) => {
        const child = enq.spawn(childLogic, { id: 'child' });
        enq.listen(child, 'someEvent', () => ({ type: 'HEARD' }));
      }
    });

    const [, effects] = initialTransition(machine);

    const spawnEffects = effects.filter(isEffect(XSTATE_SPAWN));
    const childSpawn = spawnEffects.find((e) => e.logic === childLogic)!;
    const listenerSpawn = spawnEffects.find((e) => e.logic === listenerLogic)!;

    const childRef = childSpawn.actor;
    const listenerRef = listenerSpawn.actor;

    // These `as any` casts are permanent: `start()` is not part of the public
    // ActorRef interface (it lives on the Actor class), so spying on it
    // requires widening the ref type.
    const childStart = vi.spyOn(childRef as any, 'start');
    const listenerStart = vi.spyOn(listenerRef as any, 'start');

    for (const effect of effects) {
      void effect.exec();
    }

    expect(listenerStart).toHaveBeenCalled();
    expect(childStart).toHaveBeenCalled();
    expect(listenerStart.mock.invocationCallOrder[0]).toBeLessThan(
      childStart.mock.invocationCallOrder[0]
    );
    expect(childRef.getSnapshot().status).toBe('active');
  });

  it('does not classify inherited object keys as built-in actions', () => {
    expect(
      isBuiltInExecutableAction({
        kind: 'action',
        type: 'toString',
        params: undefined,
        args: [],
        action: undefined,
        exec() {}
      })
    ).toBe(false);
  });

  it('does not classify emitted reserved event names as built-in actions', () => {
    const machine = createMachine({
      entry: (_, enq) => {
        enq.emit({ type: '@xstate.spawn' } as any);
      }
    });

    const [, effects] = initialTransition(machine);
    const emittedEffect = effects.find(
      (effect) => effect.type === XSTATE_SPAWN
    )!;

    expect(isBuiltInExecutableAction(emittedEffect)).toBe(false);
    expect(effects.filter(isEffect(XSTATE_START))).toHaveLength(0);
  });

  it('does not classify user-created reserved action shapes as built-in actions', () => {
    const actor = createActor(createMachine({}));

    expect(
      isBuiltInExecutableAction({
        kind: 'action',
        type: XSTATE_SPAWN,
        params: undefined,
        args: [actor],
        action: undefined,
        actor,
        id: actor.id,
        logic: actor.logic,
        src: actor.src,
        input: undefined
      } as any)
    ).toBe(false);
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

  it('should calculate the next snapshot for custom logic', () => {
    const logic = createLogic({
      context: { count: 0 },
      run: ({ context, event }) => {
        if (event.type === 'next') {
          return { context: { count: context.count + 1 } };
        }
        return;
      }
    });

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
            NEXT: { target: 'b' }
          }
        },
        b: {
          on: {
            NEXT: { target: 'c' }
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
            next: { target: 'waiting' }
          }
        },
        waiting: {
          after: {
            10: { target: 'done' }
          }
        },
        done: {
          type: 'final'
        }
      }
    });

    async function execute(action: ExecutableActionObject) {
      if (
        isBuiltInExecutableAction(action) &&
        action.type === '@xstate.raise' &&
        action.delay
      ) {
        const currentTime = Date.now();
        const startedAt = currentTime;
        const elapsed = currentTime - startedAt;
        const timeRemaining = Math.max(0, action.delay - elapsed);

        await new Promise((res) => setTimeout(res, timeRemaining));
        postEvent(action.event as EventFrom<typeof machine>);
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
      actorSources: {
        sendWelcomeEmail: createAsyncLogic({
          run: async () => {
            calls.push('sendWelcomeEmail');
            return {
              status: 'sent'
            };
          }
        })
      },
      initial: 'sendingWelcomeEmail',
      states: {
        sendingWelcomeEmail: {
          invoke: {
            src: ({ actorSources }) => actorSources.sendWelcomeEmail,
            input: () => ({ message: 'hello world', subject: 'hi' }),
            onDone: { target: 'logSent' }
          }
        },
        logSent: {
          invoke: {
            src: createAsyncLogic({ run: async () => {} }),
            onDone: { target: 'finish' }
          }
        },
        finish: {}
      }
    });

    const calls: string[] = [];

    async function execute(action: ExecutableActionObject) {
      if (!isBuiltInExecutableAction(action)) {
        return;
      }
      switch (action.type) {
        case '@xstate.start': {
          await action.exec();
          const startedActor = action.actor as ReturnType<typeof createActor>;
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

  it('fast-paths flat static target/context transitions', () => {
    const machine = createMachine({
      initial: 'a',
      context: { count: 0 },
      states: {
        a: {
          on: {
            NEXT: {
              target: 'b',
              context: { count: 1 }
            }
          }
        },
        b: {}
      }
    });
    const getTransitionData = vi.spyOn(machine, 'getTransitionData');

    const [init] = initialTransition(machine);
    const [next, actions] = transition(machine, init, { type: 'NEXT' });

    expect(next.value).toBe('b');
    expect(next.context).toEqual({ count: 1 });
    expect(actions).toEqual([]);
    expect(getTransitionData).not.toHaveBeenCalled();
  });

  it('fast-paths flat static targetless context transitions', () => {
    const machine = createMachine({
      initial: 'a',
      context: { count: 0 },
      states: {
        a: {
          on: {
            INC: {
              context: { count: 1 }
            }
          }
        }
      }
    });
    const getTransitionData = vi.spyOn(machine, 'getTransitionData');

    const [init] = initialTransition(machine);
    const [next, actions] = transition(machine, init, { type: 'INC' });

    expect(next.value).toBe('a');
    expect(next.context).toEqual({ count: 1 });
    expect(actions).toEqual([]);
    expect(getTransitionData).not.toHaveBeenCalled();
  });
});

describe('getNextTransitions', () => {
  it('should return all transitions from current state', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            GO_B: { target: 'b' },
            GO_C: { target: 'c' }
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
      schemas: {
        context: z.object({
          count: z.number()
        })
      },
      context: { count: 100 },
      states: {
        a: {
          on: {
            GO_B: ({ context }) => {
              if (context.count < 10) {
                return { target: 'b' };
              }
              return { target: 'd' };
            },
            GO_C: ({ context }) => {
              if (context.count > 50) {
                return { target: 'c' };
              }
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

    expect(transitions).toHaveLength(2);
    // Order should be deterministic: all GO_B transitions first (in order), then GO_C
    expect(transitions.map((t) => t.eventType)).toEqual(['GO_B', 'GO_C']);
  });

  it('should include always (eventless) transitions', () => {
    const machine = createMachine({
      initial: 'a',
      schemas: {
        context: z.object({
          count: z.number()
        })
      },
      context: { count: 5 },
      states: {
        a: {
          always: ({ context }) => {
            if (context.count > 10) {
              return { target: 'b' };
            } else if (!1) {
              return { target: 'c' };
            }
          },
          on: {
            GO_D: { target: 'd' }
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

    expect(transitions).toHaveLength(2);
    // Order: on transitions first, then always transitions (in order they appear)
    expect(transitions.map((t) => t.eventType)).toEqual(['GO_D', '']);
  });

  it('should include after (delayed) transitions', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          after: {
            1000: { target: 'b' }
          },
          on: {
            GO_C: { target: 'c' }
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
            PARENT_EVENT: { target: 'other' }
          },
          states: {
            child: {
              on: {
                CHILD_EVENT: { target: 'sibling' }
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
            SAME_EVENT: () => {
              if (!1) {
                return { target: 'parentTarget' };
              }
              return { target: 'parentTarget2' };
            }
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

    expect(transitions).toHaveLength(2);
    const sameEventTransitions = transitions.filter(
      (t) => t.eventType === 'SAME_EVENT'
    );
    // Wrapped into 1 transition in v6
    expect(sameEventTransitions).toHaveLength(2);
  });

  it('should return transitions from parallel states in document order', () => {
    const machine = createMachine({
      type: 'parallel',
      states: {
        regionA: {
          initial: 'a1',
          on: {
            REGION_A_EVENT: { target: '.a2' }
          },
          states: {
            a1: {
              on: {
                A1_EVENT: { target: 'a2' }
              }
            },
            a2: {}
          }
        },
        regionB: {
          initial: 'b1',
          on: {
            REGION_B_EVENT: { target: '.b2' }
          },
          states: {
            b1: {
              on: {
                B1_EVENT: { target: 'b2' }
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
        ROOT_EVENT: { target: '.level1' }
      },
      states: {
        level1: {
          initial: 'level2',
          on: {
            LEVEL1_EVENT: { target: '.level2' }
          },
          states: {
            level2: {
              initial: 'level3',
              on: {
                LEVEL2_EVENT: { target: '.level3' }
              },
              states: {
                level3: {
                  on: {
                    LEVEL3_EVENT: { target: 'level3' }
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
            REGION_A_EVENT: { target: '.nested' }
          },
          states: {
            nested: {
              initial: 'deep',
              on: {
                NESTED_A_EVENT: { target: '.deep' }
              },
              states: {
                deep: {
                  on: {
                    DEEP_A_EVENT: { target: 'deep' }
                  }
                }
              }
            }
          }
        },
        regionB: {
          initial: 'leaf',
          on: {
            REGION_B_EVENT: { target: '.leaf' }
          },
          states: {
            leaf: {
              on: {
                LEAF_B_EVENT: { target: 'leaf' }
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
