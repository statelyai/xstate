import { Machine, assign } from '../src/index';
import { raise } from '../src/actions';

function noop(_x) {
  return;
}

describe('StateSchema', () => {
  interface LightStateSchema {
    meta: {
      interval: number;
    };
    states: {
      green: {
        meta: { name: string };
      };
      yellow: {};
      red: {
        states: {
          walk: {};
          wait: {};
          stop: {};
        };
      };
    };
  }

  type LightEvent =
    | { type: 'TIMER' }
    | { type: 'POWER_OUTAGE' }
    | { type: 'PED_COUNTDOWN'; duration: number };

  interface LightContext {
    elapsed: number;
  }

  const lightMachine = Machine<LightContext, LightStateSchema, LightEvent>({
    key: 'light',
    initial: 'green',
    meta: { interval: 1000 },
    context: { elapsed: 0 },
    states: {
      green: {
        meta: { name: 'greenLight' },
        on: {
          TIMER: 'yellow',
          POWER_OUTAGE: 'red'
        }
      },
      yellow: {
        on: {
          TIMER: 'red',
          POWER_OUTAGE: 'red'
        }
      },
      red: {
        on: {
          TIMER: 'green',
          POWER_OUTAGE: 'red'
        },
        initial: 'walk',
        states: {
          walk: {
            on: {
              PED_COUNTDOWN: 'wait'
            }
          },
          wait: {
            on: {
              PED_COUNTDOWN: {
                target: 'stop',
                cond: (ctx, e: { type: 'PED_COUNTDOWN'; duration: number }) => {
                  return e.duration === 0 && ctx.elapsed > 0;
                }
              }
            }
          },
          stop: {
            on: {
              '': { target: 'green' }
            }
          }
        }
      }
    }
  });

  noop(lightMachine);

  it('should work with a StateSchema defined', () => {
    expect(true).toBeTruthy();
  });
});

describe('Parallel StateSchema', () => {
  interface ParallelStateSchema {
    states: {
      foo: {};
      bar: {};
      baz: {
        states: {
          one: {};
          two: {};
        };
      };
    };
  }

  type ParallelEvent =
    | { type: 'TIMER' }
    | { type: 'POWER_OUTAGE' }
    | { type: 'E' }
    | { type: 'PED_COUNTDOWN'; duration: number };

  interface ParallelContext {
    elapsed: number;
  }

  const parallelMachine = Machine<
    ParallelContext,
    ParallelStateSchema,
    ParallelEvent
  >({
    type: 'parallel',
    states: {
      foo: {},
      bar: {},
      baz: {
        initial: 'one',
        states: {
          one: { on: { E: 'two' } },
          two: {}
        }
      }
    }
  });

  noop(parallelMachine);

  it('should work with a parallel StateSchema defined', () => {
    expect(true).toBeTruthy();
  });
});

describe('Nested parallel stateSchema', () => {
  interface ParallelStateSchema {
    states: {
      foo: {};
      bar: {};
      baz: {
        states: {
          blockUpdates: {};
          activeParallelNode: {};
        };
      };
    };
  }

  interface ParallelEvent {
    type: 'UPDATE.CONTEXT';
  }

  interface ParallelContext {
    lastDate: Date;
  }

  const nestedParallelMachine = Machine<
    ParallelContext,
    ParallelStateSchema,
    ParallelEvent
  >({
    initial: 'foo',
    states: {
      foo: {},
      bar: {},
      baz: {
        type: 'parallel',
        initial: 'blockUpdates',
        states: {
          blockUpdates: { type: 'final' },
          activeParallelNode: {
            on: {
              'UPDATE.CONTEXT': {
                actions: [
                  assign({
                    lastDate: new Date()
                  })
                ]
              }
            }
          }
        }
      }
    }
  });

  noop(nestedParallelMachine);

  it('should work with a parallel StateSchema defined', () => {
    expect(true).toBeTruthy();
  });
});

describe('Raise events', () => {
  it('should work with all the ways to raise events', () => {
    interface GreetingStateSchema {
      states: {
        pending: {};
        morning: {};
        lunchTime: {};
        afternoon: {};
        evening: {};
        night: {};
      };
    }

    type GreetingEvent =
      | { type: 'DECIDE' }
      | { type: 'MORNING' }
      | { type: 'LUNCH_TIME' }
      | { type: 'AFTERNOON' }
      | { type: 'EVENING' }
      | { type: 'NIGHT' };

    interface GreetingContext {
      hour: number;
    }

    const greetingContext: GreetingContext = { hour: 10 };

    const raiseGreetingMachine = Machine<
      GreetingContext,
      GreetingStateSchema,
      GreetingEvent
    >({
      key: 'greeting',
      context: greetingContext,
      initial: 'pending',
      states: {
        pending: {
          on: {
            DECIDE: [
              {
                // This one does not work
                actions: raise<GreetingContext, { type: 'MORNING' }>({
                  type: 'MORNING'
                }),
                cond: ctx => ctx.hour < 12
              },
              {
                actions: raise<
                  GreetingContext,
                  { type: 'DECIDE' } | { type: 'LUNCH_TIME' }
                >({
                  type: 'LUNCH_TIME'
                }),
                cond: ctx => ctx.hour === 12
              },
              {
                actions: raise<GreetingContext, { type: 'AFTERNOON' }>(
                  'AFTERNOON'
                ),
                cond: ctx => ctx.hour < 18
              },
              {
                actions: raise({ type: 'EVENING' }),
                cond: ctx => ctx.hour < 22
              },
              {
                // Works and fixes the type errors for the others too.
                // Uncomment next line to see them pass :o
                // actions: raise('NIGHT'),
                cond: ctx => ctx.hour < 24
              }
            ]
          }
        },
        morning: {},
        lunchTime: {},
        afternoon: {},
        evening: {},
        night: {}
      },
      on: {
        MORNING: '.morning',
        LUNCH_TIME: '.lunchTime',
        AFTERNOON: '.afternoon',
        EVENING: '.evening',
        NIGHT: '.night'
      }
    });

    noop(raiseGreetingMachine);
    expect(true).toBeTruthy();
  });
});
