import { createMachine } from 'xstate';

const child = createMachine({
  id: 'child',
  initial: 'idle',
  states: {
    idle: {
      on: {
        PING: ({ parent }, enq) => {
          enq.sendTo(parent!, { type: 'PONG' });
          return { target: 'pinged' };
        }
      }
    },
    pinged: {
      on: {
        PING: ({ parent }, enq) => {
          enq.sendTo(parent!, { type: 'PONG' });
        }
      }
    }
  }
});

export const machine = createMachine({
  id: 'parent',
  actors: { child },
  initial: 'idle',
  context: { pongs: 0 },
  states: {
    idle: {
      on: {
        START: (_, enq) => {
          enq.spawn('child', { id: 'worker' });
          return { target: 'running' };
        }
      }
    },
    running: {
      on: {
        PING: ({ children }, enq) => {
          enq.sendTo(children.worker, { type: 'PING' });
        },
        PONG: ({ context }) => {
          return { context: { pongs: context.pongs + 1 } };
        },
        STOP: ({ children }, enq) => {
          enq.stop(children.worker);
          return { target: 'idle' };
        }
      }
    }
  }
});
