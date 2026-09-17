import { setup, types } from '../../../src/index.ts';

// `states` in `setup(...)` turns on strict transition targets, which the types
// carry through private marker keys. A machine declared this way is exported
// below, so those markers land in declaration emit.
// Exported too: a type derived from the setup itself (rather than from the
// machine) is what drags the private state-schema markers into emit.
export const strictSetup = setup({
  schemas: {
    context: types<{ attempts: number; verdict: string | null }>(),
    events: { RETRY: types<{}>(), FINISH: types<{}>() }
  },
  states: {
    deciding: { type: 'choice' },
    working: {
      states: {
        first: {},
        second: { schemas: { context: types<{ verdict: string }>() } }
      }
    },
    done: { type: 'final' }
  }
});

export const machine = strictSetup.createMachine({
  context: { attempts: 0, verdict: null },
  initial: 'deciding',
  states: {
    deciding: {
      type: 'choice',
      choice: ({ context }) =>
        context.attempts > 2 ? { target: 'done' } : { target: 'working' }
    },
    working: {
      initial: 'first',
      states: {
        first: {
          on: {
            RETRY: ({ context }) => ({
              target: 'second',
              context: { attempts: context.attempts + 1, verdict: 'pending' }
            })
          }
        },
        second: {
          on: { FINISH: { target: 'first' } }
        }
      }
    },
    done: { type: 'final' }
  }
});
