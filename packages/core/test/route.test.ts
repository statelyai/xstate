import { createActor, setup } from '../src';

describe('route', () => {
  it('should transition directly to a route if route is an empty transition config', () => {
    const machine = setup({}).createMachine({
      id: 'test',
      initial: 'a',
      states: {
        a: {},
        b: {
          route: {}
        },
        c: {}
      }
    });

    const actor = createActor(machine).start();

    actor.send({
      type: 'xstate.route.test.b'
    });

    expect(actor.getSnapshot().value).toEqual('b');

    actor.send({
      type: 'xstate.route.test.c'
    });

    expect(actor.getSnapshot().value).toEqual('b');
  });

  it('should transition directly to a route if guard passes', () => {
    const machine = setup({}).createMachine({
      id: 'test',
      initial: 'a',
      states: {
        a: {},
        b: {
          route: {
            guard: () => false
          }
        },
        c: {
          route: {
            guard: () => true
          }
        }
      }
    });

    const actor = createActor(machine).start();

    expect(actor.getSnapshot().value).toEqual('a');

    actor.send({
      type: 'xstate.route.test.b'
    });

    expect(actor.getSnapshot().value).toEqual('a');

    actor.send({
      type: 'xstate.route.test.c'
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
              route: {}
            },
            active: {
              route: {}
            },
            completed: {
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
      type: 'xstate.route.todos.filter.active'
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
          route: {}
        },
        notARoute: {
          initial: 'childRoute',
          states: {
            childRoute: {
              route: {}
            }
          }
        }
      }
    });

    const actor = createActor(machine).start();

    actor.send({
      type: 'xstate.route.root.aRoute'
    });

    actor.send({
      type: 'xstate.route.root.notARoute.childRoute'
    });

    actor.send({
      // @ts-expect-error
      type: 'xstate.route.root.notARoute'
    });

    actor.send({
      // @ts-expect-error
      type: 'xstate.route.root'
    });

    actor.send({
      // @ts-expect-error
      type: 'xstate.route.root.blahblah'
    });
  });

  it('machine.root.on should include route events', () => {
    const machine = setup({}).createMachine({
      id: 'test',
      initial: 'a',
      states: {
        a: {},
        b: {
          route: {}
        },
        c: {
          route: {
            guard: () => true
          }
        }
      }
    });

    expect(machine.root.on['xstate.route.test.b']).toBeDefined();
    expect(machine.root.on['xstate.route.test.c']).toBeDefined();
    expect(machine.root.on['xstate.route.test.a']).toBeUndefined();
  });

  it('nested state on should include route events for child routes', () => {
    const machine = setup({}).createMachine({
      id: 'app',
      initial: 'home',
      states: {
        home: {
          route: {}
        },
        dashboard: {
          initial: 'overview',
          route: {},
          states: {
            overview: {
              route: {}
            },
            settings: {
              route: {}
            }
          }
        }
      }
    });

    const a = createActor(machine).start();
    a.send({
      type: 'xstate.route.app.dashboard.overview'
    });

    // All routes should be accessible from root (routable from anywhere)
    expect(machine.root.on['xstate.route.app.home']).toBeDefined();
    expect(machine.root.on['xstate.route.app.dashboard']).toBeDefined();
    expect(
      machine.root.on['xstate.route.app.dashboard.overview']
    ).toBeDefined();
    expect(
      machine.root.on['xstate.route.app.dashboard.settings']
    ).toBeDefined();
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
              route: {}
            },
            active: {
              route: {}
            },
            completed: {
              route: {}
            }
          }
        }
      }
    });

    // Routes should be accessible from root (routable from anywhere)
    expect(machine.root.on['xstate.route.todos.filter.all']).toBeDefined();
    expect(machine.root.on['xstate.route.todos.filter.active']).toBeDefined();
    expect(
      machine.root.on['xstate.route.todos.filter.completed']
    ).toBeDefined();
  });

  it('should route to deeply nested state from anywhere', () => {
    const machine = setup({}).createMachine({
      id: 'app',
      initial: 'home',
      states: {
        home: {
          route: {}
        },
        dashboard: {
          initial: 'overview',
          states: {
            overview: {
              route: {}
            }
          }
        }
      }
    });

    const actor = createActor(machine).start();

    // Should be able to route to deeply nested state from root
    expect(actor.getSnapshot().value).toEqual('home');

    actor.send({ type: 'xstate.route.app.dashboard.overview' });

    expect(actor.getSnapshot().value).toEqual({ dashboard: 'overview' });
  });
});
