import { assert } from 'chai';
import { Machine } from '../src/index';
import { testMultiTransition } from './utils';

const composerMachine = Machine({
  strict: true,
  initial: 'ReadOnly',
  states: {
    ReadOnly: {
      id: 'ReadOnly',
      initial: 'StructureEdit',
      onEntry: ['selectNone'],
      states: {
        StructureEdit: {
          id: 'StructureEditRO',
          parallel: true,
          on: {
            switchToProjectManagement: [
              {
                target: 'ProjectManagement'
              }
            ]
          },
          states: {
            SelectionStatus: {
              initial: 'SelectedNone',
              on: {
                singleClickActivity: [
                  {
                    target: '.SelectedActivity',
                    actions: ['selectActivity']
                  }
                ],
                singleClickLink: [
                  {
                    target: '.SelectedLink',
                    actions: ['selectLink']
                  }
                ]
              },
              states: {
                SelectedNone: {
                  onEntry: ['redraw']
                },
                SelectedActivity: {
                  onEntry: ['redraw'],
                  on: {
                    singleClickCanvas: [
                      {
                        target: 'SelectedNone',
                        actions: ['selectNone']
                      }
                    ]
                  }
                },
                SelectedLink: {
                  onEntry: ['redraw'],
                  on: {
                    singleClickCanvas: [
                      {
                        target: 'SelectedNone',
                        actions: ['selectNone']
                      }
                    ]
                  }
                }
              }
            },
            ClipboardStatus: {
              initial: 'Empty',
              states: {
                Empty: {
                  onEntry: ['emptyClipboard'],
                  on: {
                    cutInClipboardSuccess: [
                      {
                        target: 'FilledByCut'
                      }
                    ],
                    copyInClipboardSuccess: [
                      {
                        target: 'FilledByCopy'
                      }
                    ]
                  }
                },
                FilledByCopy: {
                  on: {
                    cutInClipboardSuccess: [
                      {
                        target: 'FilledByCut'
                      }
                    ],
                    copyInClipboardSuccess: [
                      {
                        target: 'FilledByCopy'
                      }
                    ],
                    pasteFromClipboardSuccess: [
                      {
                        target: 'FilledByCopy'
                      }
                    ]
                  }
                },
                FilledByCut: {
                  on: {
                    cutInClipboardSuccess: [
                      {
                        target: 'FilledByCut'
                      }
                    ],
                    copyInClipboardSuccess: [
                      {
                        target: 'FilledByCopy'
                      }
                    ],
                    pasteFromClipboardSuccess: [
                      {
                        target: 'Empty'
                      }
                    ]
                  }
                }
              }
            }
          }
        },
        ProjectManagement: {
          id: 'ProjectManagementRO',
          parallel: true,
          on: {
            switchToStructureEdit: [
              {
                target: 'StructureEdit'
              }
            ]
          },
          states: {
            SelectionStatus: {
              initial: 'SelectedNone',
              on: {
                singleClickActivity: [
                  {
                    target: '.SelectedActivity',
                    actions: ['selectActivity']
                  }
                ],
                singleClickLink: [
                  {
                    target: '.SelectedLink',
                    actions: ['selectLink']
                  }
                ]
              },
              states: {
                SelectedNone: {
                  onEntry: ['redraw']
                },
                SelectedActivity: {
                  onEntry: ['redraw'],
                  on: {
                    singleClickCanvas: [
                      {
                        target: 'SelectedNone',
                        actions: ['selectNone']
                      }
                    ]
                  }
                },
                SelectedLink: {
                  onEntry: ['redraw'],
                  on: {
                    singleClickCanvas: [
                      {
                        target: 'SelectedNone',
                        actions: ['selectNone']
                      }
                    ]
                  }
                }
              }
            }
          }
        }
      }
    }
  }
});

const wakMachine = Machine({
  id: 'wakMachine',
  parallel: true,
  strict: true,
  states: {
    wak1: {
      initial: 'wak1sonA',
      states: {
        wak1sonA: {
          onEntry: 'wak1sonAenter',
          onExit: 'wak1sonAexit'
        },
        wak1sonB: {
          onEntry: 'wak1sonBenter',
          onExit: 'wak1sonBexit'
        }
      },
      on: {
        WAK1: '.wak1sonB'
      },
      onEntry: 'wak1enter',
      onExit: 'wak1exit'
    },
    wak2: {
      initial: 'wak2sonA',
      states: {
        wak2sonA: {
          onEntry: 'wak2sonAenter',
          onExit: 'wak2sonAexit'
        },
        wak2sonB: {
          onEntry: 'wak2sonBenter',
          onExit: 'wak2sonBexit'
        }
      },
      on: {
        WAK2: '.wak2sonB'
      },
      onEntry: 'wak2enter',
      onExit: 'wak2exit'
    }
  }
});

const wordMachine = Machine({
  parallel: true,
  states: {
    bold: {
      initial: 'off',
      states: {
        on: {
          on: { TOGGLE_BOLD: 'off' }
        },
        off: {
          on: { TOGGLE_BOLD: 'on' }
        }
      }
    },
    underline: {
      initial: 'off',
      states: {
        on: {
          on: { TOGGLE_UNDERLINE: 'off' }
        },
        off: {
          on: { TOGGLE_UNDERLINE: 'on' }
        }
      }
    },
    italics: {
      initial: 'off',
      states: {
        on: {
          on: { TOGGLE_ITALICS: 'off' }
        },
        off: {
          on: { TOGGLE_ITALICS: 'on' }
        }
      }
    },
    list: {
      initial: 'none',
      states: {
        none: {
          on: { BULLETS: 'bullets', NUMBERS: 'numbers' }
        },
        bullets: {
          on: { NONE: 'none', NUMBERS: 'numbers' }
        },
        numbers: {
          on: { BULLETS: 'bullets', NONE: 'none' }
        }
      }
    }
  }
});

const flatParallelMachine = Machine({
  parallel: true,
  states: {
    foo: {},
    bar: {},
    baz: {
      initial: 'one',
      states: {
        one: { on: { E: 'two' } },
        two: {}
      }
    }
  }
});

describe('parallel states', () => {
  it('should have initial parallel states', () => {
    const { initialState } = wordMachine;

    assert.deepEqual(initialState.value, {
      bold: 'off',
      italics: 'off',
      underline: 'off',
      list: 'none'
    });
  });

  const expected = {
    'bold.off': {
      TOGGLE_BOLD: {
        bold: 'on',
        italics: 'off',
        underline: 'off',
        list: 'none'
      }
    },
    'bold.on': {
      TOGGLE_BOLD: {
        bold: 'off',
        italics: 'off',
        underline: 'off',
        list: 'none'
      }
    },
    [JSON.stringify({
      bold: 'off',
      italics: 'off',
      underline: 'on',
      list: 'bullets'
    })]: {
      'TOGGLE_BOLD, TOGGLE_ITALICS': {
        bold: 'on',
        italics: 'on',
        underline: 'on',
        list: 'bullets'
      }
    }
  };

  Object.keys(expected).forEach(fromState => {
    Object.keys(expected[fromState]).forEach(eventTypes => {
      const toState = expected[fromState][eventTypes];

      it(`should go from ${fromState} to ${JSON.stringify(
        toState
      )} on ${eventTypes}`, () => {
        const resultState = testMultiTransition(
          wordMachine,
          fromState,
          eventTypes
        );

        assert.deepEqual(resultState.value, toState);
      });
    });
  });

  it('should have all parallel states represented in the state value', () => {
    const nextState = wakMachine.transition(wakMachine.initialState, 'WAK1');

    assert.deepEqual(nextState.value, { wak1: 'wak1sonB', wak2: 'wak2sonA' });
  });

  it('should have all parallel states represented in the state value (2)', () => {
    const nextState = wakMachine.transition(wakMachine.initialState, 'WAK2');

    assert.deepEqual(nextState.value, { wak1: 'wak1sonA', wak2: 'wak2sonB' });
  });

  it('should work with regions without states', () => {
    assert.deepEqual(flatParallelMachine.initialState.value, {
      foo: {},
      bar: {},
      baz: 'one'
    });
  });

  it('should work with regions without states', () => {
    const nextState = flatParallelMachine.transition(
      flatParallelMachine.initialState,
      'E'
    );
    assert.deepEqual(nextState.value, {
      foo: {},
      bar: {},
      baz: 'two'
    });
  });

  it('should properly transition to relative substate', () => {
    const nextState = composerMachine.transition(
      composerMachine.initialState,
      'singleClickActivity'
    );

    assert.deepEqual(nextState.value, {
      ReadOnly: {
        StructureEdit: {
          SelectionStatus: 'SelectedActivity',
          ClipboardStatus: 'Empty'
        }
      }
    });
  });
});
