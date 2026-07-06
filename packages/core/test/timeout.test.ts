import z from 'zod';
import { createActor, createMachine, setup } from '../src';
import { createAsyncLogic, TimeoutError } from '../src/actors/promise.ts';

afterEach(() => {
  vi.useRealTimers();
});

describe('async logic timeout', () => {
  it('aborts and errors when createAsyncLogic exceeds its timeout', () => {
    vi.useFakeTimers();

    let signal: AbortSignal | undefined;
    const logic = createAsyncLogic({
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
          onTimeout: { target: 'escalated' }
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
          onTimeout: { target: 'escalated' },
          on: { APPROVE: { target: 'approved' } }
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
          after: { 500: { target: 'periodic' } },
          timeout: 1000,
          onTimeout: { target: 'escalated' }
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
          onTimeout: { target: 'escalated' }
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
          onTimeout: { target: 'escalated' }
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
            500: ({ context, event, guards, actions }, enq) => {
              enq(afterSpy);
            }
          },
          timeout: 1000,
          onTimeout: { target: 'escalated' }
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

  it('passes state input to entry, exit, on, timeout, onTimeout, and after', () => {
    vi.useFakeTimers();

    const entrySpy = vi.fn();
    const exitSpy = vi.fn();
    const timeoutSpy = vi.fn();
    const onTimeoutSpy = vi.fn();
    const onPingSpy = vi.fn();
    const afterSpy = vi.fn();
    const machine = setup({
      schemas: {
        events: {
          activate: z.object({
            duration: z.number()
          }),
          ping: z.object({})
        }
      },
      states: {
        idle: {},
        active: {
          schemas: {
            input: z.object({
              duration: z.number()
            })
          }
        }
      }
    }).createMachine({
      initial: 'idle',
      states: {
        idle: {
          on: {
            activate: ({ event }) => ({
              target: 'active',
              input: {
                duration: event.duration
              }
            })
          }
        },
        active: {
          entry: ({ input }, enq) => {
            enq(entrySpy, input.duration);
          },
          exit: ({ input }, enq) => {
            enq(exitSpy, input.duration);
          },
          timeout: ({ input }) => {
            timeoutSpy(input.duration);

            return input.duration;
          },
          onTimeout: ({ input }, enq) => {
            enq(onTimeoutSpy, input.duration);

            return {
              target: 'idle'
            };
          },
          on: {
            ping: ({ input }, enq) => {
              onPingSpy(input.duration);
            }
          },
          after: {
            1000: ({ input }) => {
              afterSpy(input.duration);
            }
          }
        }
      }
    });

    const actor = createActor(machine).start();

    actor.send({ type: 'activate', duration: 500 });

    expect(actor.getSnapshot().value).toBe('active');
    expect(entrySpy).toHaveBeenCalledWith(500);
    // timeout resolves eagerly on entry; onTimeout waits for the delay
    expect(timeoutSpy).toHaveBeenCalledWith(500);
    expect(onTimeoutSpy).not.toHaveBeenCalled();

    // on handler receives state input
    actor.send({ type: 'ping' });
    expect(onPingSpy).toHaveBeenCalledWith(500);

    vi.advanceTimersByTime(500);
    expect(actor.getSnapshot().value).toBe('idle');
    expect(onTimeoutSpy).toHaveBeenCalledWith(500);
    expect(exitSpy).toHaveBeenCalledWith(500);
    // after fires after timeout since timeout (500ms) < after (1000ms)
    expect(afterSpy).not.toHaveBeenCalled();

    // re-enter active with longer duration so after fires first
    actor.send({ type: 'activate', duration: 2000 });
    expect(actor.getSnapshot().value).toBe('active');

    vi.advanceTimersByTime(1000);
    expect(afterSpy).toHaveBeenCalledWith(2000);
  });

  it('passes the correct state input to nested states', () => {
    const parentSpy = vi.fn();
    const childSpy = vi.fn();

    const machine = setup({
      schemas: {
        events: {
          ping: z.object({})
        }
      },
      states: {
        parent: {
          schemas: {
            input: z.object({
              label: z.literal('parent')
            })
          },
          states: {
            child: {
              schemas: {
                input: z.object({
                  label: z.literal('child')
                })
              }
            }
          }
        }
      }
    }).createMachine({
      initial: {
        target: 'parent',
        input: { label: 'parent' }
      },
      states: {
        parent: {
          initial: {
            target: 'child',
            input: { label: 'child' }
          },
          on: {
            ping: ({ input }) => {
              parentSpy(input.label);
            }
          },
          states: {
            child: {
              on: {
                ping: ({ input }) => {
                  childSpy(input.label);
                }
              }
            }
          }
        }
      }
    });

    const actor = createActor(machine).start();
    actor.send({ type: 'ping' });

    expect(childSpy).toHaveBeenCalledWith('child');
    expect(parentSpy).toHaveBeenCalledWith('parent');
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
            src: createAsyncLogic({
              run: () => new Promise((resolve) => setTimeout(resolve, 10_000))
            }),
            timeout: 1000,
            onTimeout: { target: 'timedOut' },
            onDone: { target: 'done' }
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
            src: createAsyncLogic({ run: () => Promise.resolve('ok') }),
            timeout: 5000,
            onTimeout: { target: 'timedOut' },
            onDone: { target: 'done' }
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
            src: createAsyncLogic({ run: () => Promise.resolve('ok') }),
            timeout: 1000,
            onTimeout: { target: 'timedOut' }
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
            src: createAsyncLogic({ run: () => Promise.resolve('ok') }),
            timeout: 1000,
            onTimeout: { target: 'timedOut' },
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
            src: createAsyncLogic({
              run: () => new Promise((resolve) => setTimeout(resolve, 60_000))
            }),
            timeout: ({ context }) => context.timeoutMs,
            onTimeout: { target: 'timedOut' },
            onDone: { target: 'done' }
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
              src: createAsyncLogic({ run: () => Promise.resolve('ok') }),
              timeout: 1000
            } as any
          },
          done: {}
        }
      })
    ).toThrow(/onTimeout/);
  });
});
