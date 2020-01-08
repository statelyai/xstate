import { createMachine } from 'xstate';
import { setId, setKey, deleteStateNode, deleteTransition } from '../src/index';

describe('setId', () => {
  it('sets id', () => {
    const machine = createMachine({
      id: 'light',
      initial: 'green',
      states: {
        green: {
          on: {
            TIMER: '#yellow'
          }
        },
        yellow: {
          id: 'yellow'
        }
      }
    });

    const config = setId(machine, 'yellow', 'caution');
    const newMachine = createMachine(config);

    expect(newMachine.transition('green', 'TIMER').value).toEqual('yellow');
  });

  it('sets id (deep)', () => {
    const machine = createMachine({
      id: 'light',
      initial: 'green',
      states: {
        green: {
          on: {
            TIMER: '#bar'
          }
        },
        yellow: {
          initial: 'foo',
          states: {
            foo: {},
            bar: {
              id: 'bar'
            }
          }
        }
      }
    });

    const config = setId(machine, 'bar', 'changed');
    const newMachine = createMachine(config);

    expect(newMachine.getStateNodeById('changed')).toBeTruthy();

    expect(newMachine.transition('green', 'TIMER').value).toEqual({
      yellow: 'bar'
    });
  });
});

describe('setKey', () => {
  it('sets key', () => {
    const machine = createMachine({
      id: 'light',
      initial: 'green',
      states: {
        green: {
          on: {
            TIMER: 'yellow'
          }
        },
        yellow: {}
      }
    });

    const config = setKey(machine, '#light.yellow', 'caution');

    const newMachine = createMachine(config);

    expect(newMachine.transition('green', 'TIMER').value).toEqual('caution');
  });

  it('sets key (deep)', () => {
    const machine = createMachine({
      id: 'light',
      initial: 'green',
      states: {
        green: {
          on: {
            TIMER: 'yellow.bar'
          }
        },
        yellow: {
          initial: 'foo',
          states: {
            foo: {},
            bar: {}
          }
        }
      }
    });

    const config = setKey(machine, '#light.yellow.bar', 'changed');

    const newMachine = createMachine(config);

    expect(newMachine.transition('green', 'TIMER').value).toEqual({
      yellow: 'changed'
    });
  });
});

describe('deleteStateNode', () => {
  it('deletes a state node', () => {
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
          id: 'yellow'
        }
      }
    });

    const config = deleteStateNode(machine, 'yellow');

    const newMachine = createMachine(config);

    expect(newMachine.transition('green', 'TIMER').value).toEqual('green');
  });

  it('deletes a state node (deep)', () => {
    const machine = createMachine({
      id: 'light',
      initial: 'green',
      states: {
        green: {
          on: {
            TIMER: 'yellow.bar'
          }
        },
        yellow: {
          initial: 'foo',
          states: {
            foo: {},
            bar: {
              id: 'bar'
            }
          }
        }
      }
    });

    const config = deleteStateNode(machine, 'bar');

    const newMachine = createMachine(config);

    expect(newMachine.transition('green', 'TIMER').value).toEqual('green');
  });
});

describe('deleteTransition', () => {
  it('deletes a transition', () => {
    const machine = createMachine({
      id: 'light',
      initial: 'green',
      states: {
        green: {
          id: 'green',
          on: {
            TIMER: 'yellow'
          }
        },
        yellow: {
          id: 'yellow'
        }
      }
    });

    const config = deleteTransition(machine, 'green', 'TIMER', 0);

    const newMachine = createMachine(config);

    expect(newMachine.transition('green', 'TIMER').value).toEqual('green');
  });

  it('deletes a transition (deep)', () => {
    const machine = createMachine({
      id: 'light',
      initial: 'green',
      states: {
        green: {
          initial: 'foo',
          states: {
            foo: {
              id: 'foo',
              on: {
                TIMER: '#yellow'
              }
            }
          }
        },
        yellow: {
          id: 'yellow'
        }
      }
    });

    expect(machine.transition('green', 'TIMER').value).toEqual('yellow');

    const config = deleteTransition(machine, 'foo', 'TIMER', 0);

    const newMachine = createMachine(config);

    expect(newMachine.transition('green', 'TIMER').value).toEqual({
      green: 'foo'
    });
  });
});
