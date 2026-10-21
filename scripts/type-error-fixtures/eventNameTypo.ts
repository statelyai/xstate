// Fixture: a correctly-written machine where the ONLY mistake is a typo'd
// event name at a call site (`TOGLE` instead of `TOGGLE`).
// The benchmark captures what the compiler says — a newcomer should be able
// to locate the typo from the error alone.
import { z } from 'zod';
import { createMachine, createActor } from 'xstate';

const machine = createMachine({
  schemas: {
    events: {
      TOGGLE: z.object({}),
      SET_COUNT: z.object({ count: z.number() })
    }
  },
  context: { count: 0 },
  initial: 'inactive',
  states: {
    inactive: { on: { TOGGLE: 'active' } },
    active: { on: { TOGGLE: 'inactive' } }
  }
});

const actor = createActor(machine).start();

actor.send({ type: 'TOGLE' });
