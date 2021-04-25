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

    expect(machine.initialState.tags.has('go')).toBeTruthy();
    expect(machine.transition('yellow', 'TIMER').tags.has('go')).toBeFalsy();
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

    expect(machine.initialState.tags.has('go')).toBeFalsy();
    expect(machine.initialState.tags.has('stop')).toBeTruthy();
    expect(machine.initialState.tags.has('crosswalkLight')).toBeTruthy();
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
