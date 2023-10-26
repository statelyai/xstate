import { createMachine } from 'xstate';

export const donutMachine = createMachine({
  id: 'donut',
  initial: 'ingredients',
  states: {
    ingredients: {
      on: {
        NEXT: 'directions'
      }
    },
    directions: {
      initial: 'makeDough',
      onDone: 'fry',
      states: {
        makeDough: {
          on: { NEXT: 'mix' }
        },
        mix: {
          type: 'parallel',
          states: {
            mixDry: {
              initial: 'mixing',
              states: {
                mixing: {
                  on: { MIXED_DRY: 'mixed' }
                },
                mixed: {
                  type: 'final'
                }
              }
            },
            mixWet: {
              initial: 'mixing',
              states: {
                mixing: {
                  on: { MIXED_WET: 'mixed' }
                },
                mixed: {
                  type: 'final'
                }
              }
            }
          },
          onDone: 'allMixed'
        },
        allMixed: {
          type: 'final'
        }
      }
    },
    fry: {
      on: {
        NEXT: 'flip'
      }
    },
    flip: {
      on: {
        NEXT: 'dry'
      }
    },
    dry: {
      on: {
        NEXT: 'glaze'
      }
    },
    glaze: {
      on: {
        NEXT: 'serve'
      }
    },
    serve: {
      on: {
        ANOTHER_DONUT: 'ingredients'
      }
    }
  }
});
