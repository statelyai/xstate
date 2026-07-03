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
  getNextTransitions,
  isBuiltInExecutableAction
} from '../src';
import type {
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
        // A user-emitted `{ type: '@xstate.start' }` event has no `actor`
        // property; skip it instead of crashing.
        if (!e.actor) {
          return [];
        }
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
      effect.exec?.();
    }

    expect(listenerStart).toHaveBeenCalled();
    expect(childStart).toHaveBeenCalled();
    expect(listenerStart.mock.invocationCallOrder[0]).toBeLessThan(
      childStart.mock.invocationCallOrder[0]
    );
    expect(childRef.getSnapshot().status).toBe('active');
  });

  it('initialTransition: an emitted @xstate.start event stays at its authored position, before appended real starts', () => {
    const machine = createMachine({
      schemas: {
        emitted: {
          '@xstate.start': z.object({})
        }
      },
      entry: (_, enq) => {
        enq.spawn(emittingLogic, { id: 'child' });
        enq.emit({ type: '@xstate.start' });
      }
    });

    const [, effects] = initialTransition(machine);

    const shape = effects.map((e) => ({
      type: e.type,
      hasActor: 'actor' in e
    }));

    // The emitted user event has no `actor` property; the real start effect does.
    const emittedIdx = shape.findIndex(
      (e) => e.type === '@xstate.start' && !e.hasActor
    );
    const realStartIdx = shape.findIndex(
      (e) => e.type === '@xstate.start' && e.hasActor
    );

    expect(emittedIdx).toBeGreaterThanOrEqual(0);
    expect(realStartIdx).toBeGreaterThanOrEqual(0);
    // the emitted event must not be misclassified/reordered as a real start
    expect(emittedIdx).toBeLessThan(realStartIdx);
  });

  it('does not classify inherited object keys as built-in actions', () => {
    expect(
      isBuiltInExecutableAction({
        type: 'toString',
        params: undefined,
        args: [],
        exec: undefined
      })
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
      if (action.type === '@xstate.raise' && (action.args[2] as any)?.delay) {
        const currentTime = Date.now();
        const startedAt = currentTime;
        const elapsed = currentTime - startedAt;
        const timeRemaining = Math.max(
          0,
          (action.args[2] as any)?.delay - elapsed
        );

        await new Promise((res) => setTimeout(res, timeRemaining));
        postEvent(action.args[1] as EventFrom<typeof machine>);
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
      switch (action.type) {
        case '@xstate.start': {
          action.exec?.apply(null, action.args as []);
          const startedActor = action.args[0] as ReturnType<typeof createActor>;
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
