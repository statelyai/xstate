// Fixture: a machine with named delays where the ONLY mistake is a typo'd
// delay name in `after` (`retryDelya` instead of `retryDelay`).
import { setup } from 'xstate';

setup({
  delays: { retryDelay: 1_000 }
}).createMachine({
  initial: 'waiting',
  states: {
    waiting: {
      after: {
        retryDelya: { target: 'retrying' }
      }
    },
    retrying: {}
  }
});
