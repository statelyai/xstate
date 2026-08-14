import { createActor, createMachine } from 'xstate';
import { mountActorUI } from '../../src/index.ts';

const toggleMachine = createMachine({
  id: 'toggle',
  initial: 'inactive',
  types: {
    context: {} as { toggles: number },
    events: {} as { type: 'toggle' } | { type: 'reset' }
  },
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
