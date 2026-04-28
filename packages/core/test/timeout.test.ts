import { createActor, createMachine } from '../src';
import { createLogic, TimeoutError } from '../src/actors/promise.ts';

afterEach(() => {
  vi.useRealTimers();
});

describe('async logic timeout', () => {
  it('aborts and errors when createLogic exceeds its timeout', () => {
    vi.useFakeTimers();

    let signal: AbortSignal | undefined;
    const logic = createLogic({
      id: 'slow-task',
      timeout: '10ms',
      run: ({ signal: receivedSignal }) => {
        signal = receivedSignal;
        return new Promise(() => {});
      }
    });
    const actor = createActor(logic);
    actor.subscribe({ error: () => {} });

    actor.start();
    vi.advanceTimersByTime(10);

    expect(logic.id).toBe('slow-task');
    expect(signal?.aborted).toBe(true);
    expect(actor.getSnapshot()).toEqual(
      expect.objectContaining({
        status: 'error',
        error: expect.any(TimeoutError)
      })
    );
  });
});

describe('state-level timeout', () => {
  it('transitions via onTimeout when duration elapses', () => {
    vi.useFakeTimers();

    const machine = createMachine({
      initial: 'waiting',
      states: {
        waiting: {
          timeout: 1000,
          onTimeout: 'escalated'
        },
        escalated: {}
      }
    });

    const actor = createActor(machine).start();
    expect(actor.getSnapshot().value).toBe('waiting');

    vi.advanceTimersByTime(500);
    expect(actor.getSnapshot().value).toBe('waiting');

    vi.advanceTimersByTime(600);
    expect(actor.getSnapshot().value).toBe('escalated');
  });

  it('cancels the timeout when the state is exited by another event', () => {
    vi.useFakeTimers();

    const machine = createMachine({
      initial: 'waiting',
      states: {
        waiting: {
          timeout: 1000,
          onTimeout: 'escalated',
          on: { APPROVE: 'approved' }
        },
        approved: {},
        escalated: {}
      }
    });

    const actor = createActor(machine).start();
    actor.send({ type: 'APPROVE' });
    expect(actor.getSnapshot().value).toBe('approved');

    // advance past the timeout - should NOT reach 'escalated'
    vi.advanceTimersByTime(5000);
    expect(actor.getSnapshot().value).toBe('approved');
  });

  it('coexists with `after` on the same state (independent timers)', () => {
    vi.useFakeTimers();

    const machine = createMachine({
      initial: 'waiting',
      states: {
        waiting: {
          after: { 500: 'periodic' },
          timeout: 1000,
          onTimeout: 'escalated'
        },
        periodic: {},
        escalated: {}
      }
    });

    const actor = createActor(machine).start();

    // `after: 500` fires first - state leaves `waiting`, timeout is cancelled
    vi.advanceTimersByTime(600);
    expect(actor.getSnapshot().value).toBe('periodic');
  });

  it('supports onTimeout with object form { target }', () => {
    vi.useFakeTimers();

    const machine = createMachine({
      initial: 'waiting',
      states: {
        waiting: {
          timeout: 500,
          onTimeout: { target: 'escalated' }
        },
        escalated: {}
      }
    });

    const actor = createActor(machine).start();
    vi.advanceTimersByTime(600);
    expect(actor.getSnapshot().value).toBe('escalated');
  });

  it('supports a dynamic timeout function', () => {
    vi.useFakeTimers();

    const machine = createMachine({
      context: { slaMs: 1500 },
      initial: 'waiting',
      states: {
        waiting: {
          timeout: ({ context }) => context.slaMs,
          onTimeout: 'escalated'
        },
        escalated: {}
      }
    });

    const actor = createActor(machine).start();

    vi.advanceTimersByTime(1000);
    expect(actor.getSnapshot().value).toBe('waiting');

    vi.advanceTimersByTime(600);
    expect(actor.getSnapshot().value).toBe('escalated');
  });

  it('supports a referenced delay', () => {
    vi.useFakeTimers();

    const machine = createMachine({
      delays: {
        approvalSla: 750
      },
      initial: 'waiting',
      states: {
        waiting: {
          timeout: 'approvalSla',
          onTimeout: 'escalated'
        },
        escalated: {}
      }
    });

    const actor = createActor(machine).start();

    vi.advanceTimersByTime(700);
    expect(actor.getSnapshot().value).toBe('waiting');

    vi.advanceTimersByTime(100);
    expect(actor.getSnapshot().value).toBe('escalated');
  });

  it('keeps `timeout` and `after` independent on the same state', () => {
    vi.useFakeTimers();

    const afterSpy = vi.fn();

    const machine = createMachine({
      initial: 'waiting',
      states: {
        waiting: {
          after: {
            500: { actions: afterSpy } as any
          },
          timeout: 1000,
          onTimeout: 'escalated'
        },
        escalated: {}
      }
    });

    const actor = createActor(machine).start();

    vi.advanceTimersByTime(600);
    expect(actor.getSnapshot().value).toBe('waiting');
    expect(afterSpy).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(500);
    expect(actor.getSnapshot().value).toBe('escalated');
  });

  it('throws at construction when timeout is set without onTimeout', () => {
    expect(() =>
      createMachine({
        initial: 'waiting',
        states: {
          waiting: {
            timeout: 1000
          } as any
        }
      })
    ).toThrow(/onTimeout/);
  });
});

describe('invoke-level timeout', () => {
  it('transitions via invoke.onTimeout when the invoke exceeds its timeout', async () => {
    vi.useFakeTimers();

    const machine = createMachine({
      initial: 'working',
      states: {
        working: {
          invoke: {
            src: createLogic({
              run: () => new Promise((resolve) => setTimeout(resolve, 10_000))
            }),
            timeout: 1000,
            onTimeout: 'timedOut',
            onDone: 'done'
          }
        },
        done: {},
        timedOut: {}
      }
    });

    const actor = createActor(machine).start();
    expect(actor.getSnapshot().value).toBe('working');

    vi.advanceTimersByTime(1100);
    expect(actor.getSnapshot().value).toBe('timedOut');
  });

  it('does NOT fire onTimeout if the invoke completes first', async () => {
    vi.useFakeTimers();

    const machine = createMachine({
      initial: 'working',
      states: {
        working: {
          invoke: {
            src: createLogic({ run: () => Promise.resolve('ok') }),
            timeout: 5000,
            onTimeout: 'timedOut',
            onDone: 'done'
          }
        },
        done: {},
        timedOut: {}
      }
    });

    const actor = createActor(machine).start();

    // flush the resolved promise microtasks
    await vi.runAllTimersAsync();

    expect(actor.getSnapshot().value).toBe('done');

    // further advance - should NOT reach timedOut
    vi.advanceTimersByTime(10_000);
    expect(actor.getSnapshot().value).toBe('done');
  });

  it('cancels the timeout when the invoke completes and the parent state stays active', async () => {
    vi.useFakeTimers();

    const machine = createMachine({
      initial: 'working',
      states: {
        working: {
          invoke: {
            src: createLogic({ run: () => Promise.resolve('ok') }),
            timeout: 1000,
            onTimeout: 'timedOut'
          }
        },
        timedOut: {}
      }
    });

    const actor = createActor(machine).start();

    await vi.runAllTimersAsync();

    expect(actor.getSnapshot().value).toBe('working');

    vi.advanceTimersByTime(10_000);
    expect(actor.getSnapshot().value).toBe('working');
  });

  it('cancels the timeout when invoke.onDone only enqueues actions', async () => {
    vi.useFakeTimers();

    const emittedSpy = vi.fn();

    const machine = createMachine({
      initial: 'working',
      states: {
        working: {
          invoke: {
            src: createLogic({ run: () => Promise.resolve('ok') }),
            timeout: 1000,
            onTimeout: 'timedOut',
            onDone: (_args, enq) => {
              enq.emit({ type: 'invokeDone' });
            }
          }
        },
        timedOut: {}
      }
    });

    const actor = createActor(machine);
    actor.on('invokeDone', emittedSpy);
    actor.start();

    await vi.runAllTimersAsync();

    expect(actor.getSnapshot().value).toBe('working');
    expect(emittedSpy).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(10_000);
    expect(actor.getSnapshot().value).toBe('working');
  });

  it('supports a dynamic invoke-level timeout', () => {
    vi.useFakeTimers();

    const machine = createMachine({
      context: { timeoutMs: 2000 },
      initial: 'working',
      states: {
        working: {
          invoke: {
            src: createLogic({
              run: () => new Promise((resolve) => setTimeout(resolve, 60_000))
            }),
            timeout: ({ context }) => context.timeoutMs,
            onTimeout: 'timedOut',
            onDone: 'done'
          }
        },
        done: {},
        timedOut: {}
      }
    });

    const actor = createActor(machine).start();

    vi.advanceTimersByTime(1000);
    expect(actor.getSnapshot().value).toBe('working');

    vi.advanceTimersByTime(1500);
    expect(actor.getSnapshot().value).toBe('timedOut');
  });

  it('throws at construction when invoke.timeout is set without onTimeout', () => {
    expect(() =>
      createMachine({
        initial: 'working',
        states: {
          working: {
            invoke: {
              src: createLogic({ run: () => Promise.resolve('ok') }),
              timeout: 1000
            } as any
          },
          done: {}
        }
      })
    ).toThrow(/onTimeout/);
  });
});
