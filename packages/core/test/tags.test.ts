import { createMachine, createActor } from '../src/index.ts';

describe('tags', () => {
  it('supports tagging states', () => {
    const machine = createMachine({
      initial: 'green',
      states: {
        green: {
          tags: ['go'],
          on: {
            TIMER: 'yellow'
          }
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

    const actorRef = createActor(machine).start();
    expect(actorRef.getSnapshot().hasTag('go')).toBeTruthy();
    actorRef.send({ type: 'TIMER' });
    expect(actorRef.getSnapshot().hasTag('go')).toBeTruthy();
    actorRef.send({ type: 'TIMER' });
    expect(actorRef.getSnapshot().hasTag('go')).toBeFalsy();
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

    const actorRef = createActor(machine).start();
    const initialState = actorRef.getSnapshot();

    expect(initialState.hasTag('go')).toBeFalsy();
    expect(initialState.hasTag('stop')).toBeTruthy();
    expect(initialState.hasTag('crosswalkLight')).toBeTruthy();
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

    const actorRef = createActor(machine).start();

    expect(actorRef.getSnapshot().tags).toEqual(new Set(['yes']));
    actorRef.send({ type: 'DEACTIVATE' });
    expect(actorRef.getSnapshot().tags).toEqual(new Set(['yes', 'no']));
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

    const actorRef = createActor(machine).start();
    actorRef.send({
      type: 'UNMATCHED'
    });
    expect(actorRef.getSnapshot().hasTag('myTag')).toBeTruthy();
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

    expect(createActor(machine).getSnapshot().hasTag('go')).toBeTruthy();
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

    const jsonState = createActor(machine).getSnapshot().toJSON();

    expect((jsonState as any).tags).toEqual(['go', 'light']);
  });
});
