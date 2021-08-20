import { actions, assign, createMachine, sendParent, spawn } from 'xstate';
const { stop } = actions;

import { errorMachine } from '../error/machine.js';

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

export const welcomeMachine = createMachine({
  id: 'welcomeActor',
  context: {
    celebs: [],
    lookup: undefined,
    errorActor: undefined
  },

  initial: 'idle',
  states: {
    idle: {
      on: {
        LOAD_CELEBS: 'loadingCelebs',
        SELECT_CATEGORY: {
          cond: (context, event) =>
            context.celebs.length > 0 && context?.lookup,
          actions: sendParent((context, event) => ({
            type: 'PLAY',
            data: {
              celebs: context.celebs,
              lookup: context.lookup,
              category: event.category
            }
          }))
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
          target: 'failure',
          actions: assign({
            errorActor: (context, event) => spawn(errorMachine, 'errorActor')
          })
        }
      }
    },
    failure: {
      on: {
        RETRY: 'loadingCelebs'
      },
      exit: stop('errorActor')
    }
  }
});
