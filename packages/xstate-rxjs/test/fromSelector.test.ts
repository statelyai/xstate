import { map } from 'rxjs/operators';
import { assign, createMachine } from 'xstate';
import { fromInterpret, fromSelector } from '../src';

describe('fromSelector', () => {
  it('only reassigns when selected values change', (done) => {
    const machine = createMachine<{ count: number; other: number }>({
      predictableActionArguments: true,
      initial: 'active',
      context: {
        other: 0,
        count: 0
      },
      states: {
        active: {}
      },
      on: {
        OTHER: {
          actions: assign({ other: (ctx) => ctx.other + 1 })
        },
        INCREMENT: {
          actions: assign({ count: (ctx) => ctx.count + 1 })
        }
      }
    });

    const { state$, send, service } = fromInterpret(machine);
    const withoutSelector$ = state$.pipe(map((state) => state.context.count));
    const withSelector$ = fromSelector(service, (state) => state.context.count);

    const withoutSelectorStates: number[] = [];
    const withSelectorStates: number[] = [];
    withoutSelector$.subscribe((count) => {
      withoutSelectorStates.push(count);
    });
    withSelector$.subscribe((count) => {
      withSelectorStates.push(count);
    });

    const events = [
      'INCREMENT',
      'OTHER',
      'OTHER',
      'OTHER',
      'OTHER',
      'INCREMENT'
    ];

    for (const event of events) {
      send(event);
    }

    expect(withoutSelectorStates.length).toBe(7);
    expect(withoutSelectorStates).toEqual([0, 1, 1, 1, 1, 1, 2]);

    expect(withSelectorStates.length).toBe(3);
    expect(withSelectorStates).toEqual([0, 1, 2]);

    done();
  });

  it('should work with a custom comparison function', (done) => {
    const machine = createMachine<{ name: string }>({
      predictableActionArguments: true,
      initial: 'active',
      context: {
        name: 'david'
      },
      states: {
        active: {}
      },
      on: {
        CHANGE: {
          actions: assign({ name: (_, e) => e.value })
        }
      }
    });

    const { send, service } = fromInterpret(machine);
    const name$ = fromSelector(
      service,
      (state) => state.context.name,
      (a, b) => a.toUpperCase() === b.toUpperCase()
    );

    const names: string[] = [];
    name$.subscribe((name) => {
      names.push(name);
    });

    const events = [
      { type: 'CHANGE', value: 'DAVID' },
      { type: 'CHANGE', value: 'other' },
      { type: 'CHANGE', value: 'DAVID' }
    ];
    for (const event of events) {
      send(event);
    }

    expect(names).toEqual(['david', 'other', 'DAVID']);
    done();
  });
});
