import { createMachine } from '../src';

describe('tags', () => {
  it('supports tagging states', () => {
    const machine = createMachine({
      initial: 'green',
      states: {
        green: {
          tags: ['go']
        },
        yellow: {
          tags: ['go'],
          on: {
            TIMER: 'red'
          }
        },
        red: {
          tags: ['stop']
        }
      }
    });

    expect(machine.initialState.hasTag('go')).toBeTruthy();
    expect(machine.transition('yellow', 'TIMER').hasTag('go')).toBeFalsy();
  });

  it('supports tags in compound states', () => {
    const machine = createMachine({
      initial: 'red',
      states: {
        green: {
          tags: ['go']
        },
        yellow: {},
        red: {
          tags: ['stop'],
          initial: 'walk',
          states: {
            walk: {
              tags: ['crosswalkLight']
            },
            wait: {
              tags: ['crosswalkLight']
            }
          }
        }
      }
    });

    expect(machine.initialState.hasTag('go')).toBeFalsy();
    expect(machine.initialState.hasTag('stop')).toBeTruthy();
    expect(machine.initialState.hasTag('crosswalkLight')).toBeTruthy();
  });

  it('supports tags in parallel states', () => {
    const machine = createMachine({
      type: 'parallel',
      states: {
        foo: {
          initial: 'active',
          states: {
            active: {
              tags: 'yes'
            },
            inactive: {
              tags: 'no'
            }
          }
        },
        bar: {
          initial: 'active',
          states: {
            active: {
              tags: 'yes',
              on: {
                DEACTIVATE: 'inactive'
              }
            },
            inactive: {
              tags: 'no'
            }
          }
        }
      }
    });

    let state = machine.initialState;

    expect(state.tags).toEqual(new Set(['yes']));
    state = machine.transition(state, 'DEACTIVATE');
    expect(state.tags).toEqual(new Set(['yes', 'no']));
  });

  it('sets tags correctly after not selecting any transition', () => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          tags: 'myTag'
        }
      }
    });

    const state = machine.transition(machine.initialState, {
      type: 'UNMATCHED'
    });
    expect(state.hasTag('myTag')).toBeTruthy();
  });

  it('tags can be single (not array)', () => {
    const machine = createMachine({
      initial: 'green',
      states: {
        green: {
          tags: 'go'
        }
      }
    });

    expect(machine.initialState.hasTag('go')).toBeTruthy();
  });

  it('stringifies to an array', () => {
    const machine = createMachine({
      initial: 'green',
      states: {
        green: {
          tags: ['go', 'light']
        }
      }
    });

    const jsonState = machine.initialState.toJSON();

    expect(jsonState.tags).toEqual(['go', 'light']);
  });
});
