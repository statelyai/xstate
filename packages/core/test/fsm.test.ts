import {
  createActor,
  createCallbackLogic,
  createFSM,
  initialTransition,
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
