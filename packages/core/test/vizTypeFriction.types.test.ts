import { setup, types } from '../src/index.ts';

describe('Viz v6 type ergonomics', () => {
  it('preserves an inline machine id for ID targets without as const', () => {
    const machine = setup({
      schemas: {
        events: {
          NEXT: types<void>()
        }
      }
    }).createMachine({
      id: 'gesture',
      initial: 'idle',
      states: {
        idle: {
          on: {
            NEXT: { target: 'pressed' }
          }
        },
        pressed: {
          initial: 'pending',
          states: {
            pending: {
              on: {
                NEXT: () => ({ target: '#gesture.idle' })
              }
            }
          }
        }
      }
    });

    machine.id satisfies 'gesture';
  });

  it('accepts setup-provided named delays in nested states', () => {
    const machine = setup({
      delays: {
        doubleTap: 300,
        dragHold: 120
      }
    }).createMachine({
      id: 'gesture',
      initial: 'idle',
      states: {
        idle: {
          after: {
            doubleTap: { target: 'pressed' }
          }
        },
        pressed: {
          initial: 'pending',
          states: {
            pending: {
              after: {
                dragHold: { target: 'held' }
              }
            },
            held: {}
          }
        }
      }
    });

    machine.id satisfies 'gesture';
  });
});
