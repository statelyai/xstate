import { createActor, createMachine, setup } from '../src';
import { createMachineFromConfig } from '../src/createMachineFromConfig.ts';

describe('route', () => {
  it('should transition directly to a route if route is an empty transition config', () => {
    const machine = createMachine({
      id: 'test',
      initial: 'a',
      states: {
        a: {},
        b: {
          id: 'b',
          route: {}
        },
        c: {}
      }
    });

    const actor = createActor(machine).start();

    actor.send({
      type: 'xstate.route',
      to: '#b'
    });

    expect(actor.getSnapshot().value).toEqual('b');

    // c has no route, so this should not transition
    actor.send({
      type: 'xstate.route',
      to: '#c'
    } as any);

    expect(actor.getSnapshot().value).toEqual('b');
  });

  it('should transition directly to a route if the route function allows it', () => {
    const machine = createMachine({
      id: 'test',
      initial: 'a',
      states: {
        a: {},
        b: {
          id: 'b',
          route: () => false
        },
        c: {
          id: 'c',
          route: () => true
        }
      }
    });

    const actor = createActor(machine).start();

    expect(actor.getSnapshot().value).toEqual('a');

    actor.send({
      type: 'xstate.route',
      to: '#b'
    });

    expect(actor.getSnapshot().value).toEqual('a');

    actor.send({
      type: 'xstate.route',
      to: '#c'
    });

    expect(actor.getSnapshot().value).toEqual('c');
  });

  it('should resolve guards provided in machine config on route transitions', () => {
    const machine = createMachine({
      id: 'flow',
      initial: 'amount',
      context: {
        ready: false as boolean
      },
      guards: {
        isReady: ({ context }: { context: { ready: boolean } }) => context.ready
      },
      states: {
        amount: {
          id: 'amount',
          route: {},
          on: {
            READY: () => ({
              context: { ready: true }
            })
          }
        },
        review: {
          id: 'review',
          route: (args) => args.guards.isReady(args)
        }
      }
    });

    const actor = createActor(machine).start();

    actor.send({
      type: 'xstate.route',
      to: '#review'
    });

    expect(actor.getSnapshot().value).toEqual('amount');

    actor.send({ type: 'READY' });
    actor.send({
      type: 'xstate.route',
      to: '#review'
    });

    expect(actor.getSnapshot().value).toEqual('review');
  });

  it('route function can return a config object (with context update)', () => {
    const machine = createMachine({
      id: 'app',
      context: { visits: 0, loggedIn: false },
      initial: 'home',
      states: {
        home: {
          id: 'home',
          route: {},
          on: {
            LOGIN: ({ context }) => ({
              context: { ...context, loggedIn: true }
            })
          }
        },
        profile: {
          id: 'profile',
          route: ({ context }) => {
            if (!context.loggedIn) {
              return; // blocked — like an unhandled transition
            }
            return {
              context: { ...context, visits: context.visits + 1 }
            };
          }
        }
      }
    });

    const actor = createActor(machine).start();

    actor.send({ type: 'xstate.route', to: '#profile' });
    expect(actor.getSnapshot().value).toEqual('home');
    expect(actor.getSnapshot().context.visits).toBe(0);

    actor.send({ type: 'LOGIN' });
    actor.send({ type: 'xstate.route', to: '#profile' });
    expect(actor.getSnapshot().value).toEqual('profile');
    expect(actor.getSnapshot().context.visits).toBe(1);
  });

  it('should throw on a JSON-layer route guard reference that is not implemented', () => {
    const machine = createMachineFromConfig(
      {
        id: 'flow',
        initial: 'amount',
        states: {
          amount: {
            id: 'amount',
            route: {}
          },
          review: {
            id: 'review',
            route: {
              guard: 'isRedy'
            }
          }
        }
      },
      {
        guards: {
          isReady: () => true
        }
      }
    );

    const actor = createActor(machine);
    actor.subscribe({ error: () => {} });
    actor.start();

    actor.send({
      type: 'xstate.route',
      to: '#review'
    });

    const snapshot = actor.getSnapshot();
    expect(snapshot.status).toBe('error');
    expect((snapshot as any).error.message).toMatch(
      /Guard 'isRedy' is not implemented in machine 'flow'.*Available guards: .*'isReady'/
    );
  });

  it('should work with parallel states', () => {
    const todoMachine = createMachine({
      id: 'todos',
      type: 'parallel',
      states: {
        todo: {
          initial: 'new',
          states: {
            new: {},
            editing: {}
          }
        },
        filter: {
          initial: 'all',
          states: {
            all: {
              id: 'filter-all',
              route: {}
            },
            active: {
              id: 'filter-active',
              route: {}
            },
            completed: {
              id: 'filter-completed',
              route: {}
            }
          }
        }
      }
    });

    const todoActor = createActor(todoMachine).start();

    expect(todoActor.getSnapshot().value).toEqual({
      todo: 'new',
      filter: 'all'
    });

    todoActor.send({
      type: 'xstate.route',
      to: '#filter-active'
    });

    expect(todoActor.getSnapshot().value).toEqual({
      todo: 'new',
      filter: 'active'
    });
  });

  it('route events are strongly typed', () => {
    const machine = setup({
      schemas: {
        events: {}
      }
    }).createMachine({
      id: 'root',
      initial: 'aRoute',
      states: {
        aRoute: {
          id: 'aRoute',
          route: {}
        },
        notARoute: {
          initial: 'childRoute',
          states: {
            childRoute: {
              id: 'childRoute',
              route: {}
            }
          }
        }
      }
    });

    const actor = createActor(machine).start();

    actor.send({
      type: 'xstate.route',
      to: '#aRoute'
    });

    actor.send({
      type: 'xstate.route',
      to: '#childRoute'
    });

    actor.send({
      type: 'xstate.route',
      // @ts-expect-error - 'notARoute' has no route config
      to: 'notARoute'
    });

    actor.send({
      type: 'xstate.route',
      // @ts-expect-error - 'root' is not routable
      to: 'root'
    });

    actor.send({
      type: 'xstate.route',
      // @ts-expect-error - 'blahblah' does not exist
      to: 'blahblah'
    });
  });

  it('route config without id should not generate route events', () => {
    const machine = setup({
      schemas: {
        events: {}
      }
    }).createMachine({
      id: 'test',
      initial: 'a',
      states: {
        a: {
          // route without id — should NOT be routable
          route: {}
        },
        b: {
          id: 'b',
          route: {}
        }
      }
    });

    const actor = createActor(machine).start();

    // Only 'b' should be a valid route target
    actor.send({
      type: 'xstate.route',
      to: '#b'
    });

    expect(actor.getSnapshot().value).toEqual('b');
  });

  it('machine.root.on should include route events', () => {
    const machine = createMachine({
      id: 'test',
      initial: 'a',
      states: {
        a: {},
        b: {
          id: 'b',
          route: {}
        },
        c: {
          id: 'c',
          route: () => true
        }
      }
    });

    expect(machine.root.on['xstate.route']).toBeDefined();
  });

  it('nested state on should include route events for child routes', () => {
    const machine = createMachine({
      id: 'app',
      initial: 'home',
      states: {
        home: {
          id: 'home',
          route: {}
        },
        dashboard: {
          id: 'dashboard',
          initial: 'overview',
          route: {},
          states: {
            overview: {
              id: 'overview',
              route: {}
            },
            settings: {
              id: 'settings',
              route: {}
            }
          }
        }
      }
    });

    const a = createActor(machine).start();
    a.send({
      type: 'xstate.route',
      to: '#overview'
    });

    expect(a.getSnapshot().value).toEqual({ dashboard: 'overview' });

    // All routes should be accessible via 'xstate.route'
    expect(machine.root.on['xstate.route']).toBeDefined();
  });

  it('parallel state on should include route events', () => {
    const machine = createMachine({
      id: 'todos',
      type: 'parallel',
      states: {
        list: {
          initial: 'idle',
          states: {
            idle: {},
            loading: {}
          }
        },
        filter: {
          initial: 'all',
          states: {
            all: {
              id: 'filter-all',
              route: {}
            },
            active: {
              id: 'filter-active',
              route: {}
            },
            completed: {
              id: 'filter-completed',
              route: {}
            }
          }
        }
      }
    });

    // Routes should be accessible
    expect(machine.root.on['xstate.route']).toBeDefined();
  });

  it('should route to deeply nested state from anywhere', () => {
    const machine = createMachine({
      id: 'app',
      initial: 'home',
      states: {
        home: {
          id: 'home',
          route: {}
        },
        dashboard: {
          initial: 'overview',
          states: {
            overview: {
              id: 'overview',
              route: {}
            }
          }
        }
      }
    });

    const actor = createActor(machine).start();

    // Should be able to route to deeply nested state from root
    expect(actor.getSnapshot().value).toEqual('home');

    actor.send({ type: 'xstate.route', to: '#overview' });

    expect(actor.getSnapshot().value).toEqual({ dashboard: 'overview' });
  });

  it('should re-enter when routing to the current state', () => {
    let entries = 0;
    const machine = createMachine({
      id: 'test',
      initial: 'a',
      states: {
        a: {
          id: 'a',
          route: {},
          entry: () => {
            entries++;
          }
        }
      }
    });

    const actor = createActor(machine).start();
    expect(actor.getSnapshot().value).toEqual('a');
    entries = 0;

    actor.send({ type: 'xstate.route', to: '#a' });

    expect(actor.getSnapshot().value).toEqual('a');
    expect(entries).toEqual(1);
  });

  it('should route to self with guard', () => {
    let allowed = false;
    let entries = 0;
    const machine = createMachine({
      id: 'test',
      initial: 'a',
      states: {
        a: {
          id: 'a',
          route: () => allowed,
          entry: () => {
            entries++;
          }
        },
        b: { id: 'b', route: {} }
      }
    });

    const actor = createActor(machine).start();
    entries = 0;

    actor.send({ type: 'xstate.route', to: '#a' });
    expect(entries).toEqual(0);

    allowed = true;
    actor.send({ type: 'xstate.route', to: '#a' });
    expect(entries).toEqual(1);
  });

  it('should not route using dot-separated nested id like #id.nested', () => {
    const machine = createMachine({
      id: 'app',
      initial: 'home',
      states: {
        home: {
          id: 'home',
          route: {}
        },
        dashboard: {
          id: 'dashboard',
          initial: 'overview',
          route: {},
          states: {
            overview: {
              id: 'overview',
              route: {}
            }
          }
        }
      }
    });

    const actor = createActor(machine).start();

    expect(actor.getSnapshot().value).toEqual('home');

    // Dot-separated ids should not work as route targets
    actor.send({
      type: 'xstate.route',
      // @ts-expect-error - dot-separated ids are not valid route targets
      to: '#dashboard.overview'
    });

    expect(actor.getSnapshot().value).toEqual('home');
  });
});
