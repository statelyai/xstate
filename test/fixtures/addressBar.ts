import { Machine, actions } from '../../src';

const addressBarMachine = Machine({
  id: 'addressBar',
  initial: 'idle',
  states: {
    idle: {
      on: {
        CLICK: { target: 'active', actions: 'focus' }
      }
    },
    active: {
      initial: 'focused closed',
      states: {
        'focused closed': {
          on: {
            KEY: { target: 'focused opened', actions: 'update text' }
          }
        },
        'focused opened': {
          initial: 'autocompleted',
          states: {
            autocompleted: {
              on: {
                BACKSPACE: {
                  target: 'not autocompleted',
                  actions: 'remove autocompleted text'
                }
              }
            },
            'not autocompleted': {
              on: {
                BACKSPACE: {
                  target: 'not autocompleted',
                  actions: 'update text'
                },
                ARROW_UP_DOWN: '#addressBar.selecting.withSearch'
              }
            }
          },
          on: {
            ARROW_UP_DOWN: 'selecting',
            KEY: {
              target: 'autocompleted',
              actions: 'update text'
            }
          }
        },
        selecting: {
          initial: 'default',
          states: {
            default: {
              on: {
                ESC: 'focused opened.autocompleted'
              }
            },
            withSearch: {
              on: {
                ESC: 'focused opened.not autocompleted'
              }
            }
          },
          on: {
            KEY: {
              actions: 'update text'
            }
          }
        }
      },
      on: {
        ESC: '.focused closed'
      }
    }
  }
});
