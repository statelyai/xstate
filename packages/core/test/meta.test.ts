import { z } from 'zod';
import {
  createMachine,
  createActor,
  serializeMachine,
  setup,
  StateId
} from '../src/index.ts';

describe('state meta data', () => {
  const enter_walk = () => {};
  const exit_walk = () => {};
  const enter_wait = () => {};
  const exit_wait = () => {};
  const enter_stop = () => {};
  const exit_stop = () => {};

  const pedestrianStates = {
    initial: 'walk',
    states: {
      walk: {
        meta: { walkData: 'walk data' },
        on: {
          PED_COUNTDOWN: { target: 'wait' }
        },
        entry: enter_walk,
        exit: exit_walk
      },
      wait: {
        meta: { waitData: 'wait data' },
        on: {
          PED_COUNTDOWN: { target: 'stop' }
        },
        entry: enter_wait,
        exit: exit_wait
      },
      stop: {
        meta: { stopData: 'stop data' },
        entry: enter_stop,
        exit: exit_stop
      }
    }
  };

  const enter_green = () => {};
  const exit_green = () => {};
  const enter_yellow = () => {};
  const exit_yellow = () => {};
  const enter_red = () => {};
  const exit_red = () => {};

  const lightMachine = createMachine({
    schemas: {
      meta: z.union([
        z.array(z.string()),
        z.object({
          yellowData: z.string()
        }),
        z.object({
          redData: z.object({
            nested: z.object({
              red: z.string(),
              array: z.array(z.number())
            })
          })
        }),
        z.object({
          walkData: z.string()
        }),
        z.object({
          waitData: z.string()
        }),
        z.object({
          stopData: z.string()
        })
      ])
    },
    id: 'light',
    initial: 'green',
    states: {
      green: {
        meta: ['green', 'array', 'data'],
        on: {
          TIMER: { target: 'yellow' },
          POWER_OUTAGE: { target: 'red' },
          NOTHING: { target: 'green' }
        },
        entry: (args, enq) => {
          enq(enter_green);
        },
        exit: (args, enq) => {
          enq(exit_green);
        }
      },
      yellow: {
        meta: { yellowData: 'yellow data' },
        on: {
          TIMER: { target: 'red' },
          POWER_OUTAGE: { target: 'red' }
        },
        entry: (args, enq) => {
          enq(enter_yellow);
        },
        exit: (args, enq) => {
          enq(exit_yellow);
        }
      },
      red: {
        meta: {
          redData: {
            nested: {
              red: 'data',
              array: [1, 2, 3]
            }
          }
        },
        on: {
          TIMER: { target: 'green' },
          POWER_OUTAGE: { target: 'red' },
          NOTHING: { target: 'red' }
        },
        entry: (args, enq) => {
          enq(enter_red);
        },
        exit: (args, enq) => {
          enq(exit_red);
        },
        ...pedestrianStates
      }
    }
  });

  it('states should aggregate meta data', () => {
    const actorRef = createActor(lightMachine).start();
    actorRef.send({ type: 'TIMER' });
    const yellowState = actorRef.getSnapshot();

    expect(yellowState.getMeta()).toEqual({
      'light.yellow': {
        yellowData: 'yellow data'
      }
    });
    expect('light.green' in yellowState.getMeta()).toBeFalsy();
    expect('light' in yellowState.getMeta()).toBeFalsy();
  });

  it('states should aggregate meta data (deep)', () => {
    const actorRef = createActor(lightMachine).start();
    actorRef.send({ type: 'TIMER' });
    actorRef.send({ type: 'TIMER' });
    expect(actorRef.getSnapshot().getMeta()).toEqual({
      'light.red': {
        redData: {
          nested: {
            array: [1, 2, 3],
            red: 'data'
          }
        }
      },
      'light.red.walk': {
        walkData: 'walk data'
      }
    });
  });

  // https://github.com/statelyai/xstate/issues/1105
  it('services started from a persisted state should calculate meta data', () => {
    const machine = createMachine({
      schemas: {
        meta: z.object({
          name: z.string()
        })
      },
      id: 'test',
      initial: 'first',
      states: {
        first: {
          meta: {
            name: 'first state'
          }
        },
        second: {
          meta: {
            name: 'second state'
          }
        }
      }
    });

    const actor = createActor(machine, {
      snapshot: machine.resolveState({ value: 'second' })
    });
    actor.start();

    expect(actor.getSnapshot().getMeta()).toEqual({
      'test.second': {
        name: 'second state'
      }
    });
  });

  it('meta keys are strongly-typed', () => {
    const machine = createMachine({
      schemas: {
        meta: z.object({
          template: z.string()
        })
      },
      id: 'root',
      initial: 'a',
      states: {
        a: {},
        b: {},
        c: {
          initial: 'one',
          states: {
            one: {
              id: 'one'
            },
            two: {},
            three: {}
          }
        }
      }
    });

    type M = Pick<typeof machine.states, 'id' | 'states'>;

    type T = StateId<M>;

    const actor = createActor(machine).start();

    const snapshot = actor.getSnapshot();
    const meta = snapshot.getMeta();

    meta['root'];
    meta['root.c'];
    meta['one'] satisfies { template: string } | undefined;
    // @ts-expect-error
    meta['one'] satisfies { template: number } | undefined;
    // @ts-expect-error
    meta['one'] satisfies { template: string };

    // @ts-expect-error
    meta['(machine)'];

    // @ts-expect-error
    meta['c'];

    // @ts-expect-error
    meta['root.c.one'];
  });

  it('TS should error with unexpected meta property', () => {
    createMachine({
      schemas: {
        meta: z.object({
          layout: z.string()
        })
      },
      initial: 'a',
      states: {
        a: {
          meta: {
            layout: 'a-layout'
          }
        },
        b: {
          meta: {
            notLayout: 'uh oh'
          } as any
        }
      }
    });
  });

  it('TS should error with wrong meta value type', () => {
    createMachine({
      schemas: {
        meta: z.object({
          layout: z.string()
        })
      },
      initial: 'a',
      states: {
        a: {
          meta: {
            layout: 'a-layout'
          }
        },
        d: {
          meta: {
            layout: 42
          }
        }
      } as any
    });
  });

  it('should allow states to omit meta', () => {
    createMachine({
      schemas: {
        meta: z.object({
          layout: z.string()
        })
      },
      initial: 'a',
      states: {
        a: {
          meta: {
            layout: 'a-layout'
          }
        },
        c: {} // no meta
      }
    });
  });

  it('TS should error with unexpected transition meta property', () => {
    createMachine({
      schemas: {
        meta: z.object({
          layout: z.string()
        })
      },
      on: {
        e1: () => ({
          meta: {
            layout: 'event-layout'
          }
        }),
        e2: () => ({
          meta: {
            layout: 42
          }
        })
      } as any
    });
  });

  it('TS should error with wrong transition meta value type', () => {
    createMachine({
      schemas: {
        meta: z.object({
          layout: z.string()
        })
      },
      on: {
        e1: () => ({
          meta: {
            layout: 'event-layout'
          }
        }),
        e2: () => ({
          meta: {
            layout: 42
          }
        })
      } as any
    });
  });

  it('should support typing meta properties (no ts-expected errors)', () => {
    const machine = createMachine({
      schemas: {
        meta: z.object({
          layout: z.string()
        })
      },
      initial: 'a',
      states: {
        a: {
          meta: {
            layout: 'a-layout'
          }
        },
        b: {},
        c: {},
        d: {}
      },
      on: {
        e1: () => ({
          meta: {
            layout: 'event-layout'
          }
        }),
        e2: () => ({}),
        e3: () => ({}),
        e4: () => ({})
      }
    });

    const actor = createActor(machine);

    actor.getSnapshot().getMeta()['(machine)'] satisfies
      | { layout: string }
      | undefined;

    actor.getSnapshot().getMeta()['(machine).a'];
  });

  it('should strongly type the state IDs in snapshot.getMeta()', () => {
    const machine = createMachine({
      schemas: {
        meta: z.object({})
      },
      id: 'root',
      initial: 'parentState',
      states: {
        parentState: {
          meta: {},
          initial: 'childState',
          states: {
            childState: {
              meta: {}
            },
            stateWithId: {
              id: 'state with id',
              meta: {}
            }
          }
        }
      }
    });

    const actor = createActor(machine);

    const metaValues = actor.getSnapshot().getMeta();

    metaValues.root;
    metaValues['root.parentState'];
    metaValues['root.parentState.childState'];
    metaValues['state with id'];

    // @ts-expect-error
    metaValues['root.parentState.stateWithId'];

    // @ts-expect-error
    metaValues['unknown state'];
  });

  it('should strongly type the state IDs in snapshot.getMeta() (no root ID)', () => {
    const machine = createMachine({
      schemas: {
        meta: z.object({})
      },
      // id is (machine)
      initial: 'parentState',
      states: {
        parentState: {
          meta: {},
          initial: 'childState',
          states: {
            childState: {
              meta: {}
            },
            stateWithId: {
              id: 'state with id',
              meta: {}
            }
          }
        }
      }
    });

    const actor = createActor(machine);

    const metaValues = actor.getSnapshot().getMeta();

    metaValues['(machine)'];
    metaValues['(machine).parentState'];
    metaValues['(machine).parentState.childState'];
    metaValues['state with id'];

    // @ts-expect-error
    metaValues['(machine).parentState.stateWithId'];

    // @ts-expect-error
    metaValues['unknown state'];
  });
});

describe('transition meta data', () => {
  it('supports distinct state and transition metadata schemas', () => {
    const machine = createMachine({
      schemas: {
        meta: z.object({ label: z.string() }),
        transitionMeta: z.object({ trackingId: z.number() })
      },
      meta: { label: 'root' },
      on: {
        NEXT: { meta: { trackingId: 42 } }
      }
    });

    machine.root.meta satisfies { label: string } | undefined;
    machine.root.transitions.get('NEXT')![0].meta satisfies
      | { trackingId: number }
      | undefined;
  });

  it('rejects state and transition metadata in the wrong positions', () => {
    createMachine({
      schemas: {
        meta: z.object({ state: z.string() }),
        transitionMeta: z.object({ transition: z.string() })
      },
      // @ts-expect-error transition metadata is invalid on a state node
      meta: { transition: 'root' }
    });

    createMachine({
      schemas: {
        meta: z.object({ state: z.string() }),
        transitionMeta: z.object({ transition: z.string() })
      },
      // @ts-expect-error state metadata is invalid on a transition
      on: {
        NEXT: {
          meta: { state: 'next' }
        }
      }
    });
  });

  it('uses the state metadata schema for transitions by default', () => {
    const machine = createMachine({
      schemas: {
        meta: z.object({ legacy: z.string() })
      },
      meta: { legacy: 'state' },
      on: {
        NEXT: { meta: { legacy: 'transition' } }
      }
    });

    machine.root.meta satisfies { legacy: string } | undefined;
    machine.root.transitions.get('NEXT')![0].meta satisfies
      | { legacy: string }
      | undefined;
  });

  it('preserves transition metadata on v6 transition definitions', () => {
    const machine = setup({
      schemas: {
        meta: z.object({ state: z.string() }),
        transitionMeta: z.object({ source: z.string() })
      },
      actors: {
        child: createMachine({})
      }
    }).createMachine({
      initial: {
        target: 'idle',
        meta: { source: 'initial' },
        description: 'start idle'
      },
      states: {
        idle: {
          meta: { state: 'idle' },
          route: { meta: { source: 'route' } },
          always: { meta: { source: 'always' } },
          after: {
            100: () => ({ meta: { source: 'after' } })
          },
          timeout: 200,
          onTimeout: { meta: { source: 'state.timeout' } },
          invoke: {
            src: 'child',
            timeout: 300,
            onDone: { meta: { source: 'invoke.done' } },
            onError: { meta: { source: 'invoke.error' } },
            onSnapshot: { meta: { source: 'invoke.snapshot' } },
            onTimeout: { meta: { source: 'invoke.timeout' } }
          }
        },
        routing: {
          type: 'choice',
          meta: { state: 'routing' },
          choice: () => ({
            target: 'idle',
            meta: { source: 'choice' }
          })
        }
      }
    });

    machine.root.initial.meta satisfies { source: string } | undefined;
    machine.root.states.idle.meta satisfies { state: string } | undefined;
    machine.root.states.idle.always![0].meta satisfies
      | { source: string }
      | undefined;
    machine.root.states.idle.after[0].meta satisfies
      | { source: string }
      | undefined;

    const invoke = machine.root.states.idle.invoke[0];
    type SingleTransition<T> = Exclude<
      NonNullable<T>,
      string | readonly unknown[]
    >;

    (({}) as SingleTransition<typeof invoke.onDone>).meta satisfies
      | { source: string }
      | undefined;
    (({}) as SingleTransition<typeof invoke.onError>).meta satisfies
      | { source: string }
      | undefined;
    (({}) as SingleTransition<typeof invoke.onSnapshot>).meta satisfies
      | { source: string }
      | undefined;
    (({}) as SingleTransition<typeof invoke.onTimeout>).meta satisfies
      | { source: string }
      | undefined;

    expect(machine.root.initial.meta).toEqual({ source: 'initial' });
    expect(machine.root.initial.description).toBe('start idle');
    expect(
      JSON.parse(JSON.stringify(serializeMachine(machine))).initial
    ).toMatchObject({
      meta: { source: 'initial' },
      description: 'start idle'
    });
  });

  it('TS should error with unexpected transition meta property', () => {
    createMachine({
      schemas: {
        meta: z.object({
          layout: z.string()
        })
      },
      on: {
        e1: () => ({
          meta: {
            layout: 'event-layout'
          }
        }),
        e2: () => ({
          meta: {
            notLayout: 'uh oh'
          }
        })
      } as any
    });
  });

  it('TS should error with wrong transition meta value type', () => {
    createMachine({
      schemas: {
        meta: z.object({
          layout: z.string()
        })
      },
      on: {
        e1: () => ({
          meta: {
            layout: 'event-layout'
          }
        }),
        e2: () => ({
          meta: {
            layout: 42
          }
        })
      } as any
    });
  });
});

describe('state description', () => {
  it('state node should have its description', () => {
    const machine = createMachine({
      initial: 'test',
      states: {
        test: {
          description: 'This is a test'
        }
      }
    });

    expect(machine.states.test.description).toEqual('This is a test');
  });
});

describe('transition description', () => {
  it('state node should have its description', () => {
    const machine = createMachine({
      schemas: {
        events: {
          EVENT: z.object({})
        }
      },
      on: {
        EVENT: {
          description: 'This is a test'
        }
      }
    });

    expect(machine.root.on['EVENT'][0].description).toEqual('This is a test');
  });
});
