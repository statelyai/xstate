import { createActor, createMachine } from '../src';

describe('route', () => {
  it('should transition directly to a route if route is an empty transition config', () => {
    const machine = createMachine({
      id: 'routeTest',
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
      type: 'xstate.route.b'
    });

    expect(actor.getSnapshot().value).toEqual('b');

    actor.send({
      type: 'xstate.route.c'
    });

    expect(actor.getSnapshot().value).toEqual('b');
  });

  it('should transition directly to a route if guard passes', () => {
    const machine = createMachine({
      id: 'routeTest',
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
      type: 'xstate.route.b'
    });

    expect(actor.getSnapshot().value).toEqual('a');

    actor.send({
      type: 'xstate.route.c'
    });

    expect(actor.getSnapshot().value).toEqual('c');
  });

  it('should work with parallel states', () => {
    const todoMachine = createMachine({
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
      type: 'xstate.route.filter.active'
    });

    expect(todoActor.getSnapshot().value).toEqual({
      todo: 'new',
      filter: 'active'
    });
  });
});
