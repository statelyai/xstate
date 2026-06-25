import { createMachine, assertEvent, createAsyncLogic, not } from 'xstate';
import { RMCharacter } from './common/types';
import { RickCharacters } from './services/RickApi';
import { getRandomNumber } from './common/constants';
const triviaMachine = createMachine({
  types: {
    events: {} as
      | {
          type: 'user.play';
        }
      | {
          type: 'user.close';
        }
      | {
          type: 'user.reject';
        }
      | {
          type: 'user.accept';
        }
      | {
          type: 'user.selectAnswer';
          answer: number;
        }
      | {
          type: 'user.nextQuestion';
        }
      | {
          type: 'user.toggleClue';
        }
      | {
          type: 'user.playAgain';
        },
    context: {} as {
      homePageCharacters: Array<RMCharacter>;
      hasLoaded: boolean;
      currentCharacter: RMCharacter | null;
      randomCharacters: Array<RMCharacter>;
      isClueOpened: boolean;
      points: number;
      question: number;
      lifes: number;
    }
  },
  guards: {
    isAnswerCorrect: ({ context, event }) => {
      assertEvent(event, 'user.selectAnswer');
      if (!context.currentCharacter) return false;
      return event.answer === context.currentCharacter.id;
    },
    hasLostGame: ({ context }) => {
      return context.lifes <= 0;
    },
    hasWonGame: ({ context }) => {
      return context.points >= 100;
    }
  },
  actions: {
    goToTriviaPage: () => {},
    resetTriviaData: ({ context, event, self, parent, children }) => ({
      context: {
        ...context,
        currentCharacter: null,
        randomCharacters: [],
        points: 0,
        question: 0,
        lifes: 3
      }
    })
  },
  actorSources: {
    loadHomePageCharacters: createAsyncLogic({
      run: () => RickCharacters.getCharacters(Math.floor(Math.random() * 34))
    }),
    loadSingleCharacter: createAsyncLogic({
      run: async () => {
        const randomNumber = getRandomNumber();
        const character = await RickCharacters.getCharacter(randomNumber);
        return character;
      }
    }),
    loadRandomCharacters: createAsyncLogic({
      run: () => RickCharacters.getRandomCharacters()
    })
  },
  id: 'triviaMachine',
  initial: 'homepage',
  context: {
    homePageCharacters: [],
    hasLoaded: false,
    currentCharacter: null,
    randomCharacters: [],
    isClueOpened: false,
    points: 0,
    question: 0,
    lifes: 3
  },
  states: {
    homepage: {
      initial: 'loadingData',
      states: {
        loadingData: {
          invoke: {
            src: 'loadHomePageCharacters',
            onDone: ({ context, event, guards, actions }, enq) => {
              return {
                target: 'dataLoaded',
                context: {
                  ...context,
                  homePageCharacters: (({ event }) => event.output)({
                    context: context,
                    event: event
                  }),
                  hasLoaded: true
                }
              };
            }
          }
        },
        dataLoaded: {
          on: {
            'user.play': {
              target: '#instructionModal'
            }
          }
        }
      }
    },
    instructionModal: {
      id: 'instructionModal',
      on: {
        'user.close': {
          target: 'homepage.dataLoaded'
        },
        'user.reject': {
          target: 'homepage.dataLoaded'
        },
        'user.accept': ({ context, event, guards, actions }, enq) => {
          return {
            target: 'startTrivia',
            context: { ...context, hasLoaded: false }
          };
        }
      }
    },
    startTrivia: {
      initial: 'loadQuestionData',
      id: 'startTrivia',
      entry: (args, enq) => {
        enq((actionArgs) => args.actions['goToTriviaPage'](actionArgs as any));
        enq((actionArgs) => args.actions['resetTriviaData'](actionArgs as any));
      },
      states: {
        loadQuestionData: {
          id: 'loadQuestionData',
          initial: 'loadCharacter',
          entry: (args, enq) => {
            return { context: { ...args.context, hasLoaded: false } };
          },
          states: {
            loadCharacter: {
              invoke: {
                src: 'loadSingleCharacter',
                onDone: ({ context, event, guards, actions }, enq) => {
                  return {
                    target: 'loadRandomCharacters',
                    context: {
                      ...context,
                      currentCharacter: (({ event }) => event.output)({
                        context: context,
                        event: event
                      })
                    }
                  };
                }
              }
            },
            loadRandomCharacters: {
              invoke: {
                src: 'loadRandomCharacters',
                onDone: ({ context, event, guards, actions }, enq) => {
                  return {
                    target: '#questionReady',
                    context: {
                      ...context,
                      randomCharacters: (({ event }) => event.output)({
                        context: context,
                        event: event
                      }),
                      question: (({ context }) => context.question + 1)({
                        context: context,
                        event: event
                      }),
                      hasLoaded: true
                    }
                  };
                }
              }
            }
          }
        },
        questionReady: {
          id: 'questionReady',
          initial: 'questionStart',
          on: {
            'user.toggleClue': ({ context, event, guards, actions }, enq) => {
              return {
                context: {
                  ...context,
                  ...(({ context }) => {
                    return {
                      isClueOpened: !context.isClueOpened
                    };
                  })({ context: context, event: event })
                }
              };
            }
          },
          states: {
            questionStart: {
              on: {
                'user.selectAnswer': [
                  ({ context, event, guards, actions }, enq) => {
                    if (!guards['isAnswerCorrect']({ context, event })) {
                      return;
                    }
                    return { target: 'correctAnswer' };
                  },
                  ({ context, event, guards, actions }, enq) => {
                    if (!not('isAnswerCorrect')({ context, event })) {
                      return;
                    }
                    return { target: 'incorrectAnswer' };
                  }
                ]
              }
            },
            correctAnswer: {
              entry: (args, enq) => {
                return {
                  context: {
                    ...args.context,
                    points: (({ context }) => context.points + 10)({
                      context: args.context,
                      event: args.event
                    })
                  }
                };
              },
              always: [
                ({ context, event, guards, actions }, enq) => {
                  if (!guards['hasLostGame']({ context, event })) {
                    return;
                  }
                  return { target: 'lostGame' };
                },
                ({ context, event, guards, actions }, enq) => {
                  if (!guards['hasWonGame']({ context, event })) {
                    return;
                  }
                  return { target: 'wonGame' };
                }
              ],
              on: {
                'user.nextQuestion': {
                  target: '#loadQuestionData'
                }
              }
            },
            incorrectAnswer: {
              entry: (args, enq) => {
                return {
                  context: {
                    ...args.context,
                    lifes: (({ context }) => context.lifes - 1)({
                      context: args.context,
                      event: args.event
                    })
                  }
                };
              },
              always: [
                ({ context, event, guards, actions }, enq) => {
                  if (!guards['hasLostGame']({ context, event })) {
                    return;
                  }
                  return { target: 'lostGame' };
                },
                ({ context, event, guards, actions }, enq) => {
                  if (!guards['hasWonGame']({ context, event })) {
                    return;
                  }
                  return { target: 'wonGame' };
                }
              ],
              on: {
                'user.nextQuestion': {
                  target: '#loadQuestionData'
                }
              }
            },
            lostGame: {
              on: {
                'user.playAgain': {
                  target: '#startTrivia'
                }
              }
            },
            wonGame: {
              on: {
                'user.playAgain': {
                  target: '#startTrivia'
                }
              }
            }
          }
        }
      }
    }
  }
});
export default triviaMachine;
