import { createActor, createFSM, initialTransition, transition } from '../src';

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
