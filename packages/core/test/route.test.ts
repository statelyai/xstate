import { createActor, setup } from '../src';

describe('route', () => {
  it('should transition directly to a route if route is an empty transition config', () => {
    const machine = setup({}).createMachine({
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
      to: 'b'
    });

    expect(actor.getSnapshot().value).toEqual('b');

    // c has no route, so this should not transition
    actor.send({
      type: 'xstate.route',
      to: 'c'
    } as any);

    expect(actor.getSnapshot().value).toEqual('b');
  });

  it('should transition directly to a route if guard passes', () => {
    const machine = setup({}).createMachine({
      id: 'test',
      initial: 'a',
      states: {
        a: {},
        b: {
          id: 'b',
          route: {
            guard: () => false
          }
        },
        c: {
          id: 'c',
          route: {
            guard: () => true
          }
        }
      }
    });

    const actor = createActor(machine).start();

    expect(actor.getSnapshot().value).toEqual('a');

    actor.send({
      type: 'xstate.route',
      to: 'b'
    });

    expect(actor.getSnapshot().value).toEqual('a');

    actor.send({
      type: 'xstate.route',
      to: 'c'
    });

    expect(actor.getSnapshot().value).toEqual('c');
  });

  it('should work with parallel states', () => {
    const todoMachine = setup({}).createMachine({
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
      to: 'filter-active'
    });

    expect(todoActor.getSnapshot().value).toEqual({
      todo: 'new',
      filter: 'active'
    });
  });

  it('route events are strongly typed', () => {
    const machine = setup({
      types: {
        events: {} as never
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
      to: 'aRoute'
    });

    actor.send({
      type: 'xstate.route',
      to: 'childRoute'
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
      types: {
        events: {} as never
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
      to: 'b'
    });

    expect(actor.getSnapshot().value).toEqual('b');
  });

  it('machine.root.on should include route events', () => {
    const machine = setup({}).createMachine({
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
          route: {
            guard: () => true
          }
        }
      }
    });

    expect(machine.root.on['xstate.route']).toBeDefined();
  });

  it('nested state on should include route events for child routes', () => {
    const machine = setup({}).createMachine({
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
      to: 'overview'
    });

    expect(a.getSnapshot().value).toEqual({ dashboard: 'overview' });

    // All routes should be accessible via 'xstate.route'
    expect(machine.root.on['xstate.route']).toBeDefined();
  });

  it('parallel state on should include route events', () => {
    const machine = setup({}).createMachine({
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
    const machine = setup({}).createMachine({
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

    actor.send({ type: 'xstate.route', to: 'overview' });

    expect(actor.getSnapshot().value).toEqual({ dashboard: 'overview' });
  });
});
