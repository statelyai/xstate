import React from 'react';
import { linkTo } from '@storybook/addon-links';
import { Welcome } from '@storybook/react/demo';
import { createMachine } from 'xstate';

import { StateViz } from '../src/StateViz';
import '../themes/dark.scss';

export default {
  title: 'StateViz',
  component: StateViz
};

const simpleMachine = createMachine({
  id: 'simple',
  initial: 'inactive',
  states: {
    inactive: {
      on: { TOGGLE: 'active' }
    },
    active: {
      on: { TOGGLE: 'inactive' }
    }
  }
});

export const SimpleState = () => {
  return <StateViz state={simpleMachine.initialState} />;
};

const donutMachine = createMachine({
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
    serve: {}
  }
});

export const DonutState = () => {
  return <StateViz state={donutMachine.initialState} />;
};
