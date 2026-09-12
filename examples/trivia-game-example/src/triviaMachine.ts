import { types, createMachine, createAsyncLogic } from 'xstate';
import { RMCharacter } from './common/types';
import { RickCharacters } from './services/RickApi';
import { getRandomNumber } from './common/constants';
const triviaMachine = createMachine({
  schemas: {
    events: {
      'user.play': types<{}>(),
      'user.retry': types<{}>(),
      'user.close': types<{}>(),
      'user.reject': types<{}>(),
      'user.accept': types<{}>(),
      'user.selectAnswer': types<{ answer: number }>(),
      'user.nextQuestion': types<{}>(),
      'user.toggleClue': types<{}>(),
      'user.playAgain': types<{}>()
    },
    context: types<{
      homePageCharacters: Array<RMCharacter>;
      hasLoaded: boolean;
      error: string | null;
      currentCharacter: RMCharacter | null;
      randomCharacters: Array<RMCharacter>;
      isClueOpened: boolean;
      points: number;
      question: number;
      lifes: number;
    }>()
  },
  actions: { goToTriviaPage: () => {} },
  actors: {
    loadHomePageCharacters: createAsyncLogic({
      schemas: { output: types<RMCharacter[]>() },
      run: ({ signal }) =>
        RickCharacters.getCharacters(1 + Math.floor(Math.random() * 34), signal)
    }),
    loadSingleCharacter: createAsyncLogic({
      schemas: { output: types<RMCharacter>() },
      run: ({ signal }) =>
        RickCharacters.getCharacter(getRandomNumber(), signal)
    }),
    loadRandomCharacters: createAsyncLogic({
      schemas: {
        input: types<{ excludeId: number }>(),
        output: types<RMCharacter[]>()
      },
      run: ({ input, signal }) =>
        RickCharacters.getRandomCharacters(input.excludeId, signal)
    })
  },
  id: 'triviaMachine',
  initial: 'homepage',
  context: {
    homePageCharacters: [],
    hasLoaded: false,
    error: null,
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
          entry: ({ context }) => ({
            context: { ...context, hasLoaded: false, error: null }
          }),
          invoke: {
            src: 'loadHomePageCharacters',
            onDone: ({ context, event }) => ({
              target: 'dataLoaded',
              context: {
                ...context,
                homePageCharacters: event.output,
                hasLoaded: true
              }
            }),
            onError: ({ context }) => ({
              target: 'failed',
              context: {
                ...context,
                error: 'Could not load characters. Please try again.'
              }
            })
          }
        },
        failed: { on: { 'user.retry': { target: 'loadingData' } } },
        dataLoaded: { on: { 'user.play': { target: '#instructionModal' } } }
      }
    },
    instructionModal: {
      id: 'instructionModal',
      on: {
        'user.close': { target: 'homepage.dataLoaded' },
        'user.reject': { target: 'homepage.dataLoaded' },
        'user.accept': { target: 'startTrivia' }
      }
    },
    startTrivia: {
      id: 'startTrivia',
      initial: 'loadQuestionData',
      entry: ({ context, actions }, enq) => {
        enq(actions.goToTriviaPage);
        return {
          context: {
            ...context,
            currentCharacter: null,
            randomCharacters: [],
            points: 0,
            question: 0,
            lifes: 3,
            isClueOpened: false
          }
        };
      },
      states: {
        loadQuestionData: {
          id: 'loadQuestionData',
          initial: 'loadCharacter',
          entry: ({ context }) => ({
            context: {
              ...context,
              hasLoaded: false,
              error: null,
              isClueOpened: false
            }
          }),
          states: {
            loadCharacter: {
              invoke: {
                src: 'loadSingleCharacter',
                onDone: ({ context, event }) => ({
                  target: 'loadRandomCharacters',
                  context: { ...context, currentCharacter: event.output }
                }),
                onError: ({ context }) => ({
                  target: '#questionFailed',
                  context: {
                    ...context,
                    error: 'Could not load the question. Please try again.'
                  }
                })
              }
            },
            loadRandomCharacters: {
              invoke: {
                src: 'loadRandomCharacters',
                input: ({ context }) => ({
                  excludeId: context.currentCharacter!.id
                }),
                onDone: ({ context, event }) => ({
                  target: '#questionReady',
                  context: {
                    ...context,
                    randomCharacters: event.output,
                    question: context.question + 1,
                    hasLoaded: true
                  }
                }),
                onError: ({ context }) => ({
                  target: '#questionFailed',
                  context: {
                    ...context,
                    error: 'Could not load answers. Please try again.'
                  }
                })
              }
            }
          }
        },
        questionFailed: {
          id: 'questionFailed',
          on: { 'user.retry': { target: 'loadQuestionData' } }
        },
        questionReady: {
          id: 'questionReady',
          initial: 'questionStart',
          on: {
            'user.toggleClue': ({ context }) => ({
              context: { ...context, isClueOpened: !context.isClueOpened }
            })
          },
          states: {
            questionStart: {
              on: {
                'user.selectAnswer': ({ context, event }) => ({
                  target:
                    event.answer === context.currentCharacter?.id
                      ? 'correctAnswer'
                      : 'incorrectAnswer'
                })
              }
            },
            correctAnswer: {
              entry: ({ context }) => ({
                context: { ...context, points: context.points + 10 }
              }),
              always: ({ context }) =>
                context.points >= 100 ? { target: 'wonGame' } : undefined,
              on: { 'user.nextQuestion': { target: '#loadQuestionData' } }
            },
            incorrectAnswer: {
              entry: ({ context }) => ({
                context: { ...context, lifes: context.lifes - 1 }
              }),
              always: ({ context }) =>
                context.lifes <= 0 ? { target: 'lostGame' } : undefined,
              on: { 'user.nextQuestion': { target: '#loadQuestionData' } }
            },
            lostGame: {
              on: {
                'user.playAgain': { target: '#startTrivia', reenter: true }
              }
            },
            wonGame: {
              on: {
                'user.playAgain': { target: '#startTrivia', reenter: true }
              }
            }
          }
        }
      }
    }
  }
});
export default triviaMachine;
