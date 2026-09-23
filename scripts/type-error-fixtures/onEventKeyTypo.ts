// Fixture: a machine with declared event schemas where the ONLY mistake is a
// typo'd event key in `on` (`TOGLE` instead of `TOGGLE`).
import { z } from 'zod';
import { setup } from 'xstate';

setup({
  schemas: {
    events: {
      TOGGLE: z.object({}),
      SET_COUNT: z.object({ count: z.number() })
    }
  }
}).createMachine({
  initial: 'inactive',
  states: {
    inactive: {
      on: {
        SET_COUNT: {},
        TOGLE: { target: 'active' }
      }
    },
    active: {}
  }
});
