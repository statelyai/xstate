import { assign, createMachine, sendParent, spawn } from 'xstate';

import { overMachine } from '../over/machine.js';

import { ROUNDS_PER_GAME } from '../constants.js';

export const gameMachine = (rounds) =>
  createMachine({
    id: 'gameActor',
    context: {
      rounds: rounds,
      currentRoundIndex: 0,
      results: Array(ROUNDS_PER_GAME),
      currentResult: undefined,
      overActor: undefined
    },

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
            {
              target: 'over',
              actions: assign({
                overActor: (context, event) =>
                  spawn(overMachine(context.results), 'overActor')
              })
            }
          ]
        }
      },
      over: {
        on: {
          restart: { actions: sendParent({ type: 'restart' }) }
        },
        exit: stop('overActor')
      }
    }
  });
