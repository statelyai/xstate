// Compiled in isolation by `pnpm typecheck:fsm-only` (tsconfig.fsm-only.json)
// to guarantee that a consumer importing only `xstate/fsm` typechecks without
// the main entry in the program — no `Symbol.observable` augmentation errors
// and no dependency on the full `types.ts` surface.
import { createFSM, setup, types } from '../../packages/core/src/fsm/index.ts';

type Context = { count: number };
type Event = { type: 'inc'; by: number } | { type: 'reset' };

const machine = createFSM<Context, Event, { active: unknown }>({
  initial: 'active',
  context: { count: 0 },
  states: {
    active: {
      on: {
        inc: ({ context, event }) => ({
          context: { count: context.count + event.by }
        }),
        reset: { context: { count: 0 } }
      }
    }
  }
});

const next = machine.transition(machine.initialState, { type: 'inc', by: 1 });
const _count: number = next.context.count;

const machineWithSchemas = setup({
  schemas: {
    context: types<Context>(),
    events: {
      inc: types<{ by: number }>()
    }
  }
}).createFSM({
  initial: 'active',
  context: { count: 0 },
  states: {
    active: {
      on: {
        inc: ({ context, event }) => ({
          context: { count: context.count + event.by }
        })
      }
    }
  }
});

machineWithSchemas.transition(machineWithSchemas.initialState, {
  type: 'inc',
  by: 2
});
