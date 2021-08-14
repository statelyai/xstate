import { actions, assign, createMachine, spawn } from 'xstate';
const { stop } = actions;

import { welcomeMachine } from '../welcome/machine.js';
import { gameMachine } from '../game/machine.js';

export const machine = createMachine({
  id: 'appMachine',
  context: {
    welcomeActor: undefined,
    gameActor: undefined
  },

  entry: assign({
    welcomeActor: (context, event) => spawn(welcomeMachine, 'welcomeActor')
  }),

  initial: 'welcome',
  states: {
    welcome: {
      on: {
        play: {
          target: 'game',
          actions: assign({
            gameActor: (context, event) =>
              spawn(gameMachine(event.rounds), 'gameActor')
          })
        }
      }
    },
    game: {
      on: { greet: 'welcome' },
      exit: stop('gameActor')
    }
  }
});
