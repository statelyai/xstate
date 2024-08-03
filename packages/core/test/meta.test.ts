import { createMachine, createActor, setup } from '../src/index.ts';

describe('state meta data', () => {
  const pedestrianStates = {
    initial: 'walk',
    states: {
      walk: {
        meta: { walkData: 'walk data' },
        on: {
          PED_COUNTDOWN: 'wait'
        },
        entry: 'enter_walk',
        exit: 'exit_walk'
      },
      wait: {
        meta: { waitData: 'wait data' },
        on: {
          PED_COUNTDOWN: 'stop'
        },
        entry: 'enter_wait',
        exit: 'exit_wait'
      },
      stop: {
        meta: { stopData: 'stop data' },
        entry: 'enter_stop',
        exit: 'exit_stop'
      }
    }
  };

  const lightMachine = createMachine({
    id: 'light',
    initial: 'green',
    states: {
      green: {
        meta: ['green', 'array', 'data'],
        on: {
          TIMER: 'yellow',
          POWER_OUTAGE: 'red',
          NOTHING: 'green'
        },
        entry: 'enter_green',
        exit: 'exit_green'
      },
      yellow: {
        meta: { yellowData: 'yellow data' },
        on: {
          TIMER: 'red',
          POWER_OUTAGE: 'red'
        },
        entry: 'enter_yellow',
        exit: 'exit_yellow'
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
          TIMER: 'green',
          POWER_OUTAGE: 'red',
          NOTHING: 'red'
        },
        entry: 'enter_red',
        exit: 'exit_red',
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
    const machine = setup({
      types: {
        meta: {} as { template: string }
      }
    }).createMachine({
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
    setup({
      types: {
        meta: {} as {
          layout: string;
        }
      }
    }).createMachine({
      initial: 'a',
      states: {
        a: {
          meta: {
            layout: 'a-layout'
          }
        },
        b: {
          meta: {
            // @ts-expect-error
            notLayout: 'uh oh'
          }
        }
      }
    });
  });

  it('TS should error with wrong meta value type', () => {
    setup({
      types: {
        meta: {} as {
          layout: string;
        }
      }
    }).createMachine({
      initial: 'a',
      states: {
        a: {
          meta: {
            layout: 'a-layout'
          }
        },
        d: {
          meta: {
            // @ts-expect-error
            layout: 42
          }
        }
      }
    });
  });

  it('should allow states to omit meta', () => {
    setup({
      types: {
        meta: {} as {
          layout: string;
        }
      }
    }).createMachine({
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
    setup({
      types: {
        meta: {} as {
          layout: string;
        }
      }
    }).createMachine({
      on: {
        e1: {
          meta: {
            layout: 'event-layout'
          }
        },
        e2: {
          meta: {
            // @ts-expect-error
            notLayout: 'uh oh'
          }
        }
      }
    });
  });

  it('TS should error with wrong transition meta value type', () => {
    setup({
      types: {
        meta: {} as {
          layout: string;
        }
      }
    }).createMachine({
      on: {
        e1: {
          meta: {
            layout: 'event-layout'
          }
        },
        // @ts-expect-error (error is here for some reason...)
        e2: {
          meta: {
            layout: 42
          }
        }
      }
    });
  });

  it('should support typing meta properties (no ts-expected errors)', () => {
    const machine = setup({
      types: {
        meta: {} as {
          layout: string;
        }
      }
    }).createMachine({
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
        e1: {
          meta: {
            layout: 'event-layout'
          }
        },
        e2: {},
        e3: {},
        e4: {}
      }
    });

    const actor = createActor(machine);

    actor.getSnapshot().getMeta()['(machine)'] satisfies
      | { layout: string }
      | undefined;

    actor.getSnapshot().getMeta()['(machine).a'];
  });

  it('should strongly type the state IDs in snapshot.getMeta()', () => {
    const machine = setup({}).createMachine({
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
    const machine = setup({}).createMachine({
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
  it('TS should error with unexpected transition meta property', () => {
    setup({
      types: {
        meta: {} as {
          layout: string;
        }
      }
    }).createMachine({
      on: {
        e1: {
          meta: {
            layout: 'event-layout'
          }
        },
        e2: {
          meta: {
            // @ts-expect-error
            notLayout: 'uh oh'
          }
        }
      }
    });
  });

  it('TS should error with wrong transition meta value type', () => {
    setup({
      types: {
        meta: {} as {
          layout: string;
        }
      }
    }).createMachine({
      on: {
        e1: {
          meta: {
            layout: 'event-layout'
          }
        },
        // @ts-expect-error (error is here for some reason...)
        e2: {
          meta: {
            layout: 42
          }
        }
      }
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
      on: {
        EVENT: {
          description: 'This is a test'
        }
      }
    });

    expect(machine.root.on['EVENT'][0].description).toEqual('This is a test');
  });
});
