import { createAsyncLogic, setup, types } from 'xstate';
import { getRandomNumber } from './common/constants';
import { RMCharacter } from './common/types';
import { RickCharacters } from './services/RickApi';

type TriviaContext = {
  homePageCharacters: Array<RMCharacter>;
  hasLoaded: boolean;
  currentCharacter: RMCharacter | null;
  randomCharacters: Array<RMCharacter>;
  isClueOpened: boolean;
  points: number;
  question: number;
  lifes: number;
};

const isAnswerCorrect = (answer: number, correctId: number | undefined) =>
  answer === correctId;

const hasLostGame = (lifes: number) => lifes <= 0;

const hasWonGame = (points: number) => points >= 100;

/** Fresh trivia state, reused by the initial context and by a replay. */
const initialTriviaData: Pick<
  TriviaContext,
  'currentCharacter' | 'randomCharacters' | 'points' | 'question' | 'lifes'
> = {
  currentCharacter: null,
  randomCharacters: [],
  points: 0,
  question: 0,
  lifes: 3
};

export const triviaMachine = setup({
  schemas: {
    context: types<TriviaContext>(),
    events: {
      'user.play': types<{}>(),
      'user.close': types<{}>(),
      'user.reject': types<{}>(),
      'user.accept': types<{}>(),
      'user.selectAnswer': types<{ answer: number }>(),
      'user.nextQuestion': types<{}>(),
      'user.toggleClue': types<{}>(),
      'user.playAgain': types<{}>(),
      'user.retry': types<{}>()
    }
  },
  actors: {
    loadHomePageCharacters: createAsyncLogic({
      run: () => RickCharacters.getCharacters(getRandomNumber(34))
    }),
    loadSingleCharacter: createAsyncLogic({
      run: () => RickCharacters.getCharacter(getRandomNumber())
    }),
    loadRandomCharacters: createAsyncLogic({
      run: () => RickCharacters.getRandomCharacters()
    })
  }
}).createMachine({
  id: 'triviaMachine',
  initial: 'homepage',
  context: {
    homePageCharacters: [],
    hasLoaded: false,
    isClueOpened: false,
    ...initialTriviaData
  },
  states: {
    homepage: {
      initial: 'loadingData',
      states: {
        loadingData: {
          invoke: {
            src: 'loadHomePageCharacters',
            onDone: ({ event }) => ({
              target: 'dataLoaded',
              context: { homePageCharacters: event.output, hasLoaded: true }
            }),
            onError: { target: 'loadFailed' }
          }
        },
        loadFailed: {
          entry: () => ({ context: { hasLoaded: true } }),
          on: { 'user.retry': { target: 'loadingData' } }
        },
        dataLoaded: {
          on: { 'user.play': { target: '#instructionModal' } }
        }
      }
    },
    instructionModal: {
      id: 'instructionModal',
      on: {
        'user.close': { target: 'homepage.dataLoaded' },
        'user.reject': { target: 'homepage.dataLoaded' },
        'user.accept': () => ({
          target: 'startTrivia',
          context: { hasLoaded: false }
        })
      }
    },
    startTrivia: {
      id: 'startTrivia',
      initial: 'loadQuestionData',
      entry: () => ({ context: initialTriviaData }),
      states: {
        loadQuestionData: {
          id: 'loadQuestionData',
          initial: 'loadCharacter',
          entry: () => ({ context: { hasLoaded: false } }),
          states: {
            loadCharacter: {
              invoke: {
                src: 'loadSingleCharacter',
                onDone: ({ event }) => ({
                  target: 'loadRandomCharacters',
                  context: { currentCharacter: event.output }
                }),
                onError: { target: '#questionFailed' }
              }
            },
            loadRandomCharacters: {
              invoke: {
                src: 'loadRandomCharacters',
                onDone: ({ context, event }) => ({
                  target: '#questionReady',
                  context: {
                    randomCharacters: event.output,
                    question: context.question + 1,
                    hasLoaded: true
                  }
                }),
                onError: { target: '#questionFailed' }
              }
            }
          }
        },
        loadFailed: {
          id: 'questionFailed',
          entry: () => ({ context: { hasLoaded: true } }),
          on: { 'user.retry': { target: '#loadQuestionData' } }
        },
        questionReady: {
          id: 'questionReady',
          initial: 'questionStart',
          on: {
            'user.toggleClue': ({ context }) => ({
              context: { isClueOpened: !context.isClueOpened }
            })
          },
          states: {
            questionStart: {
              on: {
                'user.selectAnswer': ({ context, event }) => ({
                  target: isAnswerCorrect(
                    event.answer,
                    context.currentCharacter?.id
                  )
                    ? 'correctAnswer'
                    : 'incorrectAnswer'
                })
              }
            },
            correctAnswer: {
              entry: ({ context }) => ({
                context: { points: context.points + 10 }
              }),
              always: ({ context }) => {
                if (hasLostGame(context.lifes)) return { target: 'lostGame' };
                if (hasWonGame(context.points)) return { target: 'wonGame' };
              },
              on: { 'user.nextQuestion': { target: '#loadQuestionData' } }
            },
            incorrectAnswer: {
              entry: ({ context }) => ({
                context: { lifes: context.lifes - 1 }
              }),
              always: ({ context }) => {
                if (hasLostGame(context.lifes)) return { target: 'lostGame' };
                if (hasWonGame(context.points)) return { target: 'wonGame' };
              },
              on: { 'user.nextQuestion': { target: '#loadQuestionData' } }
            },
            lostGame: {
              on: { 'user.playAgain': { target: '#startTrivia' } }
            },
            wonGame: {
              on: { 'user.playAgain': { target: '#startTrivia' } }
            }
          }
        }
      }
    }
  }
});
