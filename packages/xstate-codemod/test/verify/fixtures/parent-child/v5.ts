// oxlint-disable-next-line typescript/ban-ts-comment
// @ts-nocheck: loaded under xstate@5 by the verify child; typechecked as v6 here.
import {
  assign,
  createMachine,
  emit,
  sendParent,
  sendTo,
  setup,
  spawnChild,
  stopChild
} from 'xstate';

const child = createMachine({
  id: 'child',
  initial: 'idle',
  states: {
    idle: {
      on: { PING: { target: 'pinged', actions: sendParent({ type: 'PONG' }) } }
    },
    pinged: { on: { PING: { actions: sendParent({ type: 'PONG' }) } } }
  }
});

export const machine = setup({ actors: { child } }).createMachine({
  id: 'parent',
  initial: 'idle',
  context: { pongs: 0 },
  states: {
    idle: {
      on: {
        START: {
          target: 'running',
          actions: spawnChild('child', { id: 'worker' })
        }
      }
    },
    running: {
      on: {
        PING: { actions: sendTo('worker', { type: 'PING' }) },
        PONG: {
          actions: [
            assign({ pongs: ({ context }) => context.pongs + 1 }),
            emit({ type: 'pong' })
          ]
        },
        STOP: { target: 'idle', actions: stopChild('worker') }
      }
    }
  }
});
