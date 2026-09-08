import { createMachine } from 'xstate';

export const donutMachine = createMachine({
  id: 'donut',
  initial: 'ingredients',
  states: {
    ingredients: {
      on: {
        NEXT: { target: 'directions' }
      }
    },
    directions: {
      initial: 'makeDough',
      onDone: { target: 'fry' },
      states: {
        makeDough: {
          on: { NEXT: { target: 'mix' } }
        },
        mix: {
          type: 'parallel',
          states: {
            mixDry: {
              initial: 'mixing',
              states: {
                mixing: {
                  on: { MIXED_DRY: { target: 'mixed' } }
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
                  on: { MIXED_WET: { target: 'mixed' } }
                },
                mixed: {
                  type: 'final'
                }
              }
            }
          },
          onDone: { target: 'allMixed' }
        },
        allMixed: {
          type: 'final'
        }
      }
    },
    fry: {
      on: {
        NEXT: { target: 'flip' }
      }
    },
    flip: {
      on: {
        NEXT: { target: 'dry' }
      }
    },
    dry: {
      on: {
        NEXT: { target: 'glaze' }
      }
    },
    glaze: {
      on: {
        NEXT: { target: 'serve' }
      }
    },
    serve: {
      on: {
        ANOTHER_DONUT: { target: 'ingredients' }
      }
    }
  }
});
