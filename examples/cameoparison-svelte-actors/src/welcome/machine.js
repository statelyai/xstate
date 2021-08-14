import { actions, assign, createMachine, sendParent, spawn } from 'xstate';
const { stop } = actions;

import { errorMachine } from '../error/machine.js';

import { ROUNDS_PER_GAME } from '../constants.js';
import { select } from './select.js';
import { loadImage } from '../utils.js';

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

export const welcomeMachine = createMachine({
  id: 'welcomeActor',
  context: {
    celebs: [],
    lookup: undefined,
    selectedCategory: undefined,
    errorActor: undefined
  },

  initial: 'idle',
  states: {
    idle: {
      entry: assign({ selectedCategory: undefined }),
      on: {
        loadCelebs: 'loadingCelebs',
        selectCategory: {
          cond: (context, event) =>
            context.celebs.length > 0 && context?.lookup,
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
          actions: assign({
            errorActor: (context, event) =>
              spawn(errorMachine('loadingCelebs'), 'errorActor')
          })
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
          target: 'idle',
          actions: sendParent((context, event) => ({
            type: 'play',
            rounds: event.data
          }))
        },
        onError: {
          target: 'error',
          actions: assign({
            errorActor: (context, event) =>
              spawn(errorMachine('idle'), 'errorActor')
          })
        }
      }
    },

    error: {
      on: {
        retry: [
          {
            cond: (context, event) => event.targetState === 'loadingCelebs',
            target: 'loadingCelebs'
          },
          {
            cond: (context, event) => event.targetState === 'idle',
            target: 'idle'
          }
        ]
      },
      exit: stop('errorActor')
    }
  }
});
