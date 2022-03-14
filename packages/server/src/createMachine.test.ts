import { createMachine } from './createMachine';
import { testMachine } from './testMachine';

const machine = createMachine(
  {
    tsTypes: {
      args: {} as number,
      context: {} as { val: string }
    },
    context: { val: '' },
    initial: 'idle',
    states: {
      idle: {
        type: 'sync',
        transitions: [
          {
            target: 'prom'
          }
        ]
      },
      prom: {
        type: 'async',
        promise: 'prom',
        onDone: [
          {
            target: 'finish',
            actions: ['ok']
          }
        ],
        onError: [],
        timeout: '0'
      },
      finish: { type: 'final' }
    }
  },
  {
    promises: {
      prom: async () => true
    },
    actions: {
      ok: (ctx) => {
        ctx.val = 'true';
      }
    }
  }
);

describe('Machine', () => {
  testMachine({
    machine,
    tests: [
      {
        args: 2,
        enteredStates: ['idle', 'prom', 'finish']
      },
      {
        args: 12,
        enteredStates: ['idle', 'prom', 'finish']
      },
      {
        args: 2,
        expected: { val: 'true' }
      },
      {
        args: 3,
        expected: { val: 'true' },
        enteredStates: ['idle', 'prom', 'finish']
      }
    ]
  });
});
