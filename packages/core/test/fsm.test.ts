import {
  createActor,
  createCallbackLogic,
  createFSM,
  initialTransition,
  SimulatedClock,
  transition
} from '../src';

describe('createFSM', () => {
  it('transitions through a direct flat event table', () => {
    const fsm = createFSM({
      initial: 'off',
      states: {
        off: {
          on: {
            toggle: { target: 'on' }
          }
        },
        on: {
          on: {
            toggle: { target: 'off' }
          }
        }
      }
    });

    const [init] = initialTransition(fsm);
    const [next] = transition(fsm, init, { type: 'toggle' });

    expect(next.value).toBe('on');
  });

  it('supports transition functions and enqueued actions', () => {
    const action = vi.fn();
    const fsm = createFSM({
      initial: 'a',
      context: { count: 0 },
      states: {
        a: {
          on: {
            next: ({ context }, enq) => {
              enq(action);
              return {
                target: 'b',
                context: { count: context.count + 1 }
              };
            }
          }
        },
        b: {}
      }
    });

    const [init] = initialTransition(fsm);
    const [next, actions] = transition(fsm, init, { type: 'next' });

    expect(next.value).toBe('b');
    expect(next.context.count).toBe(1);
    expect(actions).toHaveLength(1);
  });

  it('evaluates a function transition once when its target has entry actions', () => {
    const transition = vi.fn(() => ({ target: 'b' }));
    const fsm = createFSM({
      initial: 'a',
      states: {
        a: { on: { next: transition } },
        b: { entry: () => {} }
      }
    });
    const actor = createActor(fsm).start();

    actor.send({ type: 'next' });

    expect(transition).toHaveBeenCalledTimes(1);
  });

  it('evaluates a function transition once when its target has an eventless transition', () => {
    const transition = vi.fn(() => ({ target: 'b' }));
    const fsm = createFSM({
      initial: 'a',
      states: {
        a: { on: { next: transition } },
        b: { always: { target: 'c' } },
        c: {}
      }
    });
    const actor = createActor(fsm).start();

    actor.send({ type: 'next' });

    expect(transition).toHaveBeenCalledTimes(1);
    expect(actor.getSnapshot().value).toBe('c');
  });

  it('evaluates a function transition once when its target is final', () => {
    const transition = vi.fn(() => ({ target: 'done' }));
    const fsm = createFSM({
      initial: 'active',
      states: {
        active: { on: { finish: transition } },
        done: { type: 'final' }
      }
    });
    const actor = createActor(fsm).start();

    actor.send({ type: 'finish' });

    expect(transition).toHaveBeenCalledTimes(1);
    expect(actor.getSnapshot().status).toBe('done');
  });

  it('passes arguments and enqueue to object transition actions', () => {
    const calls: string[] = [];
    const fsm = createFSM({
      initial: 'idle',
      context: { count: 1 },
      states: {
        idle: {
          on: {
            run: {
              actions: ({ context, event }, enq) => {
                enq(() => calls.push(`${event.type}:${context.count}`));
                return { context: { count: 2 } };
              }
            }
          }
        }
      }
    });
    const actor = createActor(fsm).start();

    actor.send({ type: 'run' });

    expect(calls).toEqual(['run:1']);
    expect(actor.getSnapshot().context).toEqual({ count: 2 });
  });

  it('drains raised events from object transition actions', () => {
    const fsm = createFSM({
      initial: 'idle',
      states: {
        idle: {
          on: {
            start: {
              actions: (_, enq) => enq.raise({ type: 'continue' })
            },
            continue: { target: 'ready' }
          }
        },
        ready: {}
      }
    });
    const actor = createActor(fsm).start();

    actor.send({ type: 'start' });

    expect(actor.getSnapshot().value).toBe('ready');
  });

  it('resolves mapper context on object transitions', () => {
    const fsm = createFSM({
      initial: 'idle',
      context: { count: 0 },
      states: {
        idle: {
          on: {
            inc: {
              context: ({ context }) => ({ count: context.count + 1 })
            }
          }
        }
      }
    });

    const [init] = initialTransition(fsm);
    const [next] = transition(fsm, init, { type: 'inc' });

    expect(next.context.count).toBe(1);
  });

  it('supports targetless function transitions that update context', () => {
    const fsm = createFSM({
      initial: 'idle',
      context: { count: 0 },
      states: {
        idle: {
          on: {
            inc: ({ context }) => ({
              context: { count: context.count + 1 }
            })
          }
        }
      }
    });

    const [init] = initialTransition(fsm);
    const [next, actions] = transition(fsm, init, { type: 'inc' });

    expect(next.value).toBe('idle');
    expect(next.context.count).toBe(1);
    expect(actions).toEqual([]);
  });

  it('supports guards, entry, exit, and target input', () => {
    const calls: string[] = [];
    const fsm = createFSM({
      initial: 'idle',
      context: ({ input }: { input: { start: number } }) => ({
        count: input.start
      }),
      states: {
        idle: {
          exit: ({ context }) => {
            calls.push(`exit:${context.count}`);
          },
          on: {
            go: [
              {
                guard: ({ context }) => context.count < 0,
                target: 'idle'
              },
              {
                target: 'active',
                context: { count: 2 },
                input: ({ context }) => ({ seen: context.count })
              }
            ]
          }
        },
        active: {
          entry: ({ input }) => {
            calls.push(`entry:${input?.seen}`);
          }
        }
      }
    });

    const [init] = initialTransition(fsm, { start: 1 });
    const [next] = transition(fsm, init, { type: 'go' });

    expect(next.value).toBe('active');
    expect(next.context.count).toBe(2);
    expect(calls).toEqual(['exit:1', 'entry:2']);
  });

  it('drains sync raised events', () => {
    const fsm = createFSM({
      initial: 'a',
      states: {
        a: {
          on: {
            first: (_, enq) => {
              enq.raise({ type: 'second' });
              return { target: 'b' };
            }
          }
        },
        b: {
          on: {
            second: { target: 'c' }
          }
        },
        c: {}
      }
    });

    const [init] = initialTransition(fsm);
    const [next] = transition(fsm, init, { type: 'first' });

    expect(next.value).toBe('c');
  });

  it('drains sync raised events from initial entry', () => {
    const fsm = createFSM({
      initial: 'a',
      states: {
        a: {
          entry: (_, enq) => {
            enq.raise({ type: 'next' });
          },
          on: {
            next: { target: 'b' }
          }
        },
        b: {}
      }
    });

    const [init] = initialTransition(fsm);

    expect(init.value).toBe('b');
  });

  it('rejects string transition targets', () => {
    expect(() =>
      createFSM({
        initial: 'off',
        states: {
          off: {
            on: {
              toggle: 'on'
            }
          },
          on: {}
        }
      } as any)
    ).toThrow('use { target: "on" } instead of a string target');
  });

  it('works as actor logic', () => {
    const fsm = createFSM({
      initial: 'idle',
      context: { count: 0 },
      states: {
        idle: {
          on: {
            inc: {
              context: { count: 1 }
            }
          }
        }
      }
    });

    const actor = createActor(fsm).start();
    actor.send({ type: 'inc' });

    expect(actor.getSnapshot().context.count).toBe(1);
  });

  it('stabilizes chained eventless transitions', () => {
    const fsm = createFSM({
      initial: 'checking',
      context: { count: 0 },
      states: {
        checking: {
          always: [
            {
              guard: ({ context }) => context.count < 2,
              actions: ({ context }) => ({
                context: { count: context.count + 1 }
              })
            },
            { target: 'ready' }
          ]
        },
        ready: {}
      }
    });

    const [snapshot] = initialTransition(fsm);

    expect(snapshot).toMatchObject({
      status: 'active',
      value: 'ready',
      context: { count: 2 }
    });
  });

  it('stabilizes eventless transitions after a fast-path event transition', () => {
    const fsm = createFSM({
      initial: 'checking',
      context: { ready: false },
      states: {
        checking: {
          always: {
            guard: ({ context }) => context.ready,
            target: 'ready'
          },
          on: {
            enable: { context: { ready: true } }
          }
        },
        ready: {}
      }
    });
    const actor = createActor(fsm).start();

    actor.send({ type: 'enable' });

    expect(actor.getSnapshot().value).toBe('ready');
  });

  it('returns one terminal effect for an initially final state', () => {
    const fsm = createFSM({
      initial: 'done',
      states: { done: { type: 'final' } }
    });

    const [snapshot, effects] = initialTransition(fsm);

    expect(snapshot.status).toBe('done');
    expect(
      effects.filter((effect) => effect.type === '@xstate.terminate')
    ).toHaveLength(1);
  });

  it('stops children and cancels timers on final completion', () => {
    const stopped = vi.fn();
    const child = createCallbackLogic(() => () => stopped());
    const clock = new SimulatedClock();
    const fsm = createFSM({
      initial: 'active',
      states: {
        active: {
          entry: (_, enq) => {
            enq.spawn(child, { id: 'child' });
            enq.raise({ type: 'later' }, { delay: 100, id: 'later' });
          },
          on: { finish: { target: 'done' } }
        },
        done: { type: 'final' }
      }
    });
    const actor = createActor(fsm, { clock }).start();

    actor.send({ type: 'finish' });

    expect(actor.getSnapshot().children).toEqual({});
    expect(actor.getSnapshot().timers).toEqual({});
    expect(stopped).toHaveBeenCalledTimes(1);
  });
});

describe('createFSM spawning', () => {
  it('starts a child spawned via enq.spawn() in entry', () => {
    let started = false;
    const child = createCallbackLogic(() => {
      started = true;
    });
    const fsm = createFSM({
      initial: 'a',
      states: {
        a: {
          entry: (_, enq) => {
            enq.spawn(child, { id: 'child' });
          }
        }
      }
    });
    const actor = createActor(fsm);
    actor.start();

    expect(Object.keys(actor.getSnapshot().children)).toContain('child');
    expect(started).toBe(true);
  });

  it('attaches a listener before its target starts so startup emits are captured', () => {
    const child = createCallbackLogic(({ emit }) => {
      // Emitted synchronously during the target's own start.
      emit({ type: 'childEvent' });
    });

    const receivedEvents: any[] = [];

    const fsm = createFSM({
      initial: 'a',
      states: {
        a: {
          entry: (_, enq) => {
            const childRef = enq.spawn(child, { id: 'child' });
            enq.listen(childRef, 'childEvent', () => ({
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

    createActor(fsm).start();

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].type).toBe('CHILD_EMITTED');
  });

  it('attaches listeners from object transition actions', () => {
    const receivedEvents: string[] = [];
    let childRef: any;
    const child = createCallbackLogic(({ receive, emit }) => {
      receive(() => emit({ type: 'childEvent' }));
    });
    const fsm = createFSM({
      initial: 'active',
      states: {
        active: {
          entry: (_, enq) => {
            childRef = enq.spawn(child, { id: 'child' });
          },
          on: {
            attach: {
              actions: (_, enq) => {
                enq.listen(childRef, 'childEvent', () => ({ type: 'heard' }));
              }
            },
            heard: ({ event }, enq) => {
              enq(() => receivedEvents.push(event.type));
            }
          }
        }
      }
    });
    const actor = createActor(fsm).start();

    actor.send({ type: 'attach' });
    childRef.send({ type: 'trigger' });

    expect(receivedEvents).toEqual(['heard']);
  });

  it('does not double-start a child spawned from a raise-drained transition', () => {
    let startCount = 0;
    const child = createCallbackLogic(() => {
      startCount++;
    });
    const fsm = createFSM({
      initial: 'a',
      states: {
        a: {
          entry: (_, enq) => {
            enq.raise({ type: 'GO' });
          },
          on: {
            GO: { target: 'b' }
          }
        },
        b: {
          entry: (_, enq) => {
            enq.spawn(child, { id: 'child' });
          }
        }
      }
    });

    // Pure effects: the derived start must appear exactly once even though
    // `initialTransition` drains the raised `GO` through the transition core.
    const [, effects] = initialTransition(fsm);
    const childSpawns = effects.filter(
      (e) => e.type === '@xstate.spawn' && (e as any).id === 'child'
    );
    const childStarts = effects.filter(
      (e) => e.type === '@xstate.start' && (e as any).id === 'child'
    );
    expect(childSpawns).toHaveLength(1);
    expect(childStarts).toHaveLength(1);

    // Behavioral: the child logic runs exactly once on start.
    const actor = createActor(fsm);
    actor.start();
    expect(Object.keys(actor.getSnapshot().children)).toContain('child');
    expect(startCount).toBe(1);
  });
});

describe('createFSM spawn allocation', () => {
  it('spawns in the transition function and entry of one step get distinct ids', () => {
    const child = createCallbackLogic(() => {});
    const namedChild = Object.assign(child, { id: 'job' });
    const fsm = createFSM({
      initial: 'a',
      states: {
        a: {
          on: {
            GO: (_, enq) => {
              enq.spawn(namedChild);
              return { target: 'b' };
            }
          }
        },
        b: {
          entry: (_, enq) => {
            enq.spawn(namedChild);
          }
        }
      }
    });
    const actor = createActor(fsm);
    actor.start();
    actor.send({ type: 'GO' });

    const ids = Object.keys(actor.getSnapshot().children);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });
});
