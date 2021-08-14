import { assign, createMachine, send } from 'xstate';

import { ROUNDS_PER_GAME } from './constants.js';
import { select } from './select.js';
import { loadImage } from './utils.js';

const loadCelebs = async () => {
  const res = await fetch('https://cameo-explorer.netlify.app/celebs.json');
  const data = await res.json();

  const lookup = new Map();
  data.forEach((c) => {
    lookup.set(c.id, c);
  });

  const subset = new Set();
  data.forEach((celeb) => {
    if (celeb.reviews >= 50) {
      subset.add(celeb);
      celeb.similar.forEach((id) => {
        subset.add(lookup.get(id));
      });
    }
  });

  return {
    celebs: Array.from(subset),
    lookup
  };
};

const loadRounds = (selection) => {
  return Promise.all(selection.map((round) => loadCelebPair(round)));
};

const loadCelebPair = (round) => {
  return Promise.all([loadCelebDetails(round.a), loadCelebDetails(round.b)]);
};

const loadCelebDetails = async (celeb) => {
  const res = await fetch(
    `https://cameo-explorer.netlify.app/celebs/${celeb.id}.json`
  );
  const details = await res.json();
  await loadImage(details.image);
  return details;
};

const initialGameContext = {
  selectedCategory: undefined,
  rounds: [],
  currentRoundIndex: -1,
  results: Array(ROUNDS_PER_GAME),
  currentResult: undefined
};

export const machine = createMachine({
  id: 'app',
  context: {
    celebs: [],
    lookup: undefined,
    targetState: undefined,
    ...initialGameContext
  },

  initial: 'welcome',
  states: {
    welcome: {
      initial: 'idle',
      states: {
        idle: {
          entry: assign(initialGameContext),
          on: {
            loadCelebs: 'loadingCelebs',
            selectCategory: {
              cond: (context, event) =>
                context.celebs.length > 0 && context.lookup,
              target: 'loadingRounds',
              actions: assign({
                selectedCategory: (context, event) => event.category
              })
            }
          }
        },
        loadingCelebs: {
          invoke: {
            src: (context, event) => loadCelebs(),
            onDone: {
              target: 'idle',
              actions: assign({
                celebs: (context, event) => event.data.celebs,
                lookup: (context, event) => event.data.lookup
              })
            },
            onError: {
              target: 'error',
              actions: assign({ targetState: 'loadingCelebs' })
            }
          }
        },
        loadingRounds: {
          invoke: {
            src: (context, event) =>
              loadRounds(
                select(
                  context.celebs,
                  context.lookup,
                  context.selectedCategory.slug,
                  ROUNDS_PER_GAME
                )
              ),
            onDone: {
              actions: [
                assign({
                  rounds: (context, event) => event.data,
                  currentRoundIndex: 0
                }),
                send('play')
              ]
            },
            onError: {
              target: 'error',
              actions: assign({ targetState: 'idle' })
            }
          }
        },

        error: {
          on: {
            retry: [
              {
                cond: (context, event) =>
                  context.targetState === 'loadingCelebs',
                target: 'loadingCelebs'
              },
              {
                cond: (context, event) => context.targetState === 'idle',
                target: 'idle'
              }
            ]
          }
        }
      }
    },

    game: {
      initial: 'question',
      states: {
        question: {
          on: {
            answer: {
              target: 'result',
              actions: assign({
                currentResult: (context, event) =>
                  Math.sign(event.a.price - event.b.price) === event.sign
                    ? 'right'
                    : 'wrong'
              })
            }
          }
        },
        result: {
          after: {
            1500: {
              target: 'next',
              actions: assign({
                results: (context, event) => [
                  ...context.results.slice(0, context.currentRoundIndex),
                  context.currentResult,
                  ...context.results.slice(context.currentRoundIndex + 1)
                ]
              })
            }
          }
        },
        next: {
          after: {
            500: [
              {
                cond: (context, event) =>
                  context.currentRoundIndex < ROUNDS_PER_GAME - 1,
                target: 'question',
                actions: assign({
                  currentRoundIndex: (context, event) =>
                    context.currentRoundIndex + 1
                })
              },
              { target: 'over' }
            ]
          }
        },
        over: {}
      },
      on: { restart: 'welcome' }
    }
  },
  on: { play: 'game' }
});
