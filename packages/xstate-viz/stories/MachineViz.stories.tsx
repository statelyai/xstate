import React from 'react';
import { linkTo } from '@storybook/addon-links';
import { Welcome } from '@storybook/react/demo';
import { createMachine } from 'xstate';

import { MachineViz } from '../src/MachineViz';
import '../themes/dark.scss';

export default {
  title: 'MachineViz',
  component: MachineViz
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

export const SimpleMachine = () => {
  return (
    <MachineViz machine={simpleMachine} state={simpleMachine.initialState} />
  );
};

const simpleMachineWithActions = createMachine({
  id: 'with actions',
  initial: 'inactive',
  entry: [
    'string entry',
    { type: 'object entry', foo: 'bar' },
    () => {
      /* anonymous function */
    }
  ],
  exit: [
    'string exit',
    { type: 'object exit', foo: 'bar' },
    () => {
      /* anonymous function */
    }
  ],
  states: {
    inactive: {
      entry: [
        'string entry',
        { type: 'object entry', foo: 'bar' },
        () => {
          /* anonymous function */
        }
      ],
      exit: [
        'string exit',
        { type: 'object exit', foo: 'bar' },
        () => {
          /* anonymous function */
        }
      ],
      on: {
        TOGGLE: { target: 'active', actions: ['action1', 'action2'] },
        CLICK: 'active'
      }
    },
    active: {
      on: { TOGGLE: 'inactive' }
    }
  }
});

export const WithActions = () => {
  return (
    <MachineViz
      machine={simpleMachineWithActions}
      state={simpleMachineWithActions.initialState}
    />
  );
};

const parallelMachine = createMachine({
  id: 'parallel',
  initial: 'active',
  states: {
    active: {
      type: 'parallel',
      states: {
        first: {
          initial: 'one',
          states: {
            one: {
              on: { TOGGLE: 'two' }
            },
            two: {
              on: { TOGGLE: 'one' }
            }
          }
        },
        second: {
          initial: 'one',
          states: {
            one: {
              on: { TOGGLE: 'two' }
            },
            two: {
              on: { TOGGLE: 'one' }
            }
          }
        },
        third: {}
      }
    }
  }
});

export const ParallelMachine = () => {
  return (
    <MachineViz
      machine={parallelMachine}
      state={parallelMachine.initialState}
    />
  );
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

export const DonutMachine = () => {
  return (
    <MachineViz machine={donutMachine} state={donutMachine.initialState} />
  );
};
