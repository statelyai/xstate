import React, { useEffect } from 'react';
import { linkTo } from '@storybook/addon-links';
import { Welcome } from '@storybook/react/demo';
import { createMachine, actions } from 'xstate';

import { MachineViz } from '../src/MachineViz';
import '../themes/dark.scss';
import './style.scss';
import { useMachine } from '@xstate/react';

const {
  raise,
  send,
  sendParent,
  log,
  cancel,
  assign,
  respond,
  forwardTo,
  escalate,
  choose,
  pure
} = actions;

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
  meta: {
    description:
      'Demonstrats entry, exit, and do actions on parent and child nodes.'
  },
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

const historyMachine = createMachine({
  initial: 'active',
  states: {
    active: {
      initial: 'first',
      states: {
        first: {},
        second: {
          initial: 'one',
          states: {
            one: {},
            two: {},
            three: {}
          }
        },
        history: { type: 'history' },
        dh: { type: 'history', history: 'deep' }
      },
      on: {
        DEACTIVATE: 'inactive'
      }
    },
    inactive: {
      on: {
        ACTIVATE: 'active.history'
      }
    }
  }
});

export const HistoryMachine = () => {
  return (
    <MachineViz machine={historyMachine} state={historyMachine.initialState} />
  );
};

const finalMachine = createMachine({
  id: 'final',
  initial: 'inactive',
  states: {
    inactive: {
      on: { TOGGLE: 'active' }
    },
    active: {
      type: 'final',
      entry: 'some action'
    }
  }
});

export const FinalMachine = () => {
  return <MachineViz machine={finalMachine} />;
};

const todoMachine = createMachine<{ todos: any[] }>({
  id: 'todoApp',
  initial: 'empty',
  context: {
    todos: []
  },
  states: {
    empty: {
      id: 'empty',
      on: {
        ADD_TODO: {
          actions: assign({
            todos: (_, e) => [{ message: e.message, completed: 'false' }]
          }),
          target: 'nonempty'
        }
      },
      initial: 'start',
      states: {
        start: {},
        afterDelete: {}
      }
    },
    nonempty: {
      on: {
        DELETE_TODO: {
          actions: assign({
            todos: []
          }),
          target: 'empty.afterDelete'
        },
        TOGGLE_ALL: '.allCompleted',
        NAV_ALL: '.allActive',
        NAV_ACTIVE: '.allActive'
      },
      initial: 'allActive',
      states: {
        allActive: {
          on: {
            TOGGLE_ALL: {
              actions: assign({
                todos: (ctx) =>
                  ctx.todos.map((todo) => ({ ...todo, completed: true }))
              }),
              target: 'allCompleted'
            },
            TOGGLE_TODO: {
              actions: assign({
                todos: (ctx) =>
                  ctx.todos.map((todo) => ({ ...todo, completed: true }))
              }),
              target: 'allCompleted'
            },
            NAV_COMPLETED: '#empty',
            NAV_ACTIVE: 'allActive'
          }
        },
        allCompleted: {
          on: {
            TOGGLE_ALL: {
              actions: assign({
                todos: (ctx) =>
                  ctx.todos.map((todo) => ({ ...todo, completed: false }))
              }),
              target: 'allActive'
            },
            TOGGLE_TODO: {
              actions: assign({
                todos: (ctx) =>
                  ctx.todos.map((todo) => ({ ...todo, completed: false }))
              }),
              target: 'allActive'
            },
            NAV_COMPLETED: 'allCompleted',
            NAV_ACTIVE: '#empty',
            NAV_ALL: 'allCompleted'
          }
        }
      }
    }
  }
});

export const TodoMachine = () => {
  return <MachineViz machine={todoMachine} />;
};

const actionsMachine = createMachine({
  id: 'actions',
  initial: 'raise',
  context: {},
  states: {
    raise: {
      entry: raise('SOME_EVENT'),
      on: {
        SOME_EVENT: {
          target: 'send',
          actions: 'someAction'
        }
      }
    },
    send: {
      entry: [send('SOME_EVENT'), send(() => ({ type: 'SOME_DYNAMIC_EVENT' }))]
    },
    sendTo: {
      entry: send('SOME_EVENT', { to: 'wherever' })
    },
    sendParent: {
      entry: sendParent('SOME_EVENT')
    },
    log: {
      entry: log('hello', 'this is a label'),
      exit: log(() => 'some expr', 'another label')
    },
    cancel: {
      entry: [cancel('anid')]
    },
    assign: {
      entry: assign({
        number: 100,
        string: 'hello',
        array: ['foo', ['bar', 'baz']]
      }),
      exit: assign(() => ({
        number: 100,
        string: 'hello',
        array: ['foo', ['bar', 'baz']]
      }))
    },
    respond: {
      entry: respond('HELLO')
    },
    forwardTo: {
      entry: forwardTo('someTarget')
    },
    escalate: {
      entry: escalate({ foo: 'bar' })
    },
    choose: {
      entry: choose([
        { actions: 'dothis', cond: 'iftrue' },
        { actions: ['ordothis', 'andthis'], cond: 'iflesstrue' },
        { actions: 'orgiveup' }
      ])
    },
    pure: {
      entry: pure(() => {
        return ['someAction', { type: 'anotherAction' }];
      })
    }
  }
});

export const ActionsMachine = () => {
  return <MachineViz machine={actionsMachine} />;
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
    serve: {
      on: {
        ANOTHER_DONUT: 'ingredients'
      }
    }
  }
});

export const DonutMachine = () => {
  const [state, send] = useMachine(donutMachine);

  useEffect(() => {
    setTimeout(() => {
      send(state.nextEvents[0]);
    }, 1000);
  }, [state]);

  return <MachineViz machine={donutMachine} state={state} />;
};

const feedbackMachine = createMachine({
  id: 'feedback',
  initial: 'question',
  states: {
    form: {
      on: {
        CLOSE: 'closed',
        SUBMIT: 'thanks'
      }
    },
    closed: {
      on: {
        REOPEN: 'question'
      }
    },
    thanks: {
      on: {
        CLOSE: 'closed'
      }
    },
    question: {
      on: {
        CLOSE: 'closed',
        CLICK_BAD: 'form',
        CLICK_GOOD: 'thanks'
      }
    }
  }
});

export const FeedbackMachine = () => {
  const [state, send] = useMachine(feedbackMachine);

  useEffect(() => {
    setTimeout(() => {
      console.log('sending', state.nextEvents[0]);
      send(state.nextEvents[0]);
    }, 1000);
  }, [state]);

  return <MachineViz machine={feedbackMachine} state={state} />;
};
