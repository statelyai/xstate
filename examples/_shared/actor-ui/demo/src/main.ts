import { createActor, setup, types } from 'xstate';
import { mountActorUI } from '../../src/index.ts';

const toggleMachine = setup({
  schemas: {
    context: types<{ toggles: number }>(),
    events: {
      toggle: types<{}>(),
      reset: types<{}>()
    }
  }
}).createMachine({
  id: 'toggle',
  initial: 'inactive',
  context: { toggles: 0 },
  states: {
    inactive: {
      on: {
        toggle: {
          target: 'active',
          context: ({ context }) => ({ toggles: context.toggles + 1 })
        }
      }
    },
    active: {
      on: {
        toggle: {
          target: 'inactive',
          context: ({ context }) => ({ toggles: context.toggles + 1 })
        },
        reset: { target: 'inactive' }
      }
    }
  }
});

const actor = createActor(toggleMachine);

mountActorUI(actor, document.querySelector<HTMLDivElement>('#app')!, {
  title: 'toggleMachine'
});

actor.start();
