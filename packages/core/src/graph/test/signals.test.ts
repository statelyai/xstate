import { createMachine, setup } from '../../index.ts';
import { ALWAYS_SIGNAL, compileMachineSignals } from '../index.ts';

describe('compileMachineSignals()', () => {
  it('should compile transitions into explicit signal routes', () => {
    const machine = createMachine({
      id: 'light',
      initial: 'green',
      states: {
        green: {
          on: {
            TIMER: 'yellow'
          }
        },
        yellow: {
          on: {
            TIMER: 'red'
          }
        },
        red: {
          always: {
            target: 'green'
          }
        }
      }
    });

    const compiled = compileMachineSignals(machine, { includeEventless: true });

    expect(
      compiled.bySignal.TIMER.routes.map((route) => ({
        source: route.source,
        targets: route.targets
      }))
    ).toEqual([
      {
        source: '#light.green',
        targets: ['#light.yellow']
      },
      {
        source: '#light.yellow',
        targets: ['#light.red']
      }
    ]);

    expect(
      compiled.bySignal[ALWAYS_SIGNAL].routes.map((route) => ({
        source: route.source,
        targets: route.targets
      }))
    ).toEqual([
      {
        source: '#light.red',
        targets: ['#light.green']
      }
    ]);
  });

  it('should compile xstate.route transitions with explicit route targets', () => {
    const machine = setup({}).createMachine({
      id: 'app',
      initial: 'home',
      states: {
        home: {
          id: 'home',
          route: {}
        },
        settings: {
          id: 'settings',
          route: {}
        },
        notRoutable: {
          route: {}
        }
      }
    });

    const compiled = compileMachineSignals(machine);
    const routeSignal = compiled.bySignal['xstate.route'];

    expect(routeSignal.kind).toBe('route');
    expect(routeSignal.routes.map((route) => route.source)).toEqual([
      '#app',
      '#app'
    ]);
    expect(routeSignal.routes.map((route) => route.targets).sort()).toEqual([
      ['#home'],
      ['#settings']
    ]);
  });
});
