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

  initial: 'welcome',
  states: {
    welcome: {
      on: {
        PLAY: {
          target: 'game',
          actions: assign({
            gameActor: (context, event) =>
              spawn(gameMachine(event.data), 'gameActor')
          })
        }
      }
    },
    game: {
      on: {
        GREET: 'welcome'
      },
      exit: [stop('gameActor'), assign({ gameActor: undefined })]
    }
  },

  entry: assign({
    welcomeActor: (context, event) => spawn(welcomeMachine, 'welcomeActor')
  }),


  exit: [stop('welcomeActor'), assign({ welcomeActor: undefined })],

  preserveActionOrder: true
});
