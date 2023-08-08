import { createActor, createMachine } from '../src';

describe('route', () => {
  it('should transition directly to a route if route: true', () => {
    const machine = createMachine({
      id: 'routeTest',
      initial: 'a',
      states: {
        a: {},
        b: {
          route: true
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
});
