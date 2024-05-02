import { createMachine, assign } from 'xstate';

export const machine = createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QGMD2BXAdgFzAJwDoo8wxMBiAFQEkBZAUQCUBtABgF1FQAHVWAS2z9UmLiAAeiAMysAbABoQAT0QAmAJyyAvlsVosuQkrAAbE6gDuVOkzackIXgKEixkhDIXLEAVgCM2rog+jj4BCQQ1gwsHGJOgsKiDu6yrIoqCKo+ABw6ehihRqbmVvQAbmTYAASqdnF8Ca7JiAAsrOrp0rKqBFKyAOx+2f0+ecEFhgQAcmAWVbDYAIa4VX7k5ZWrdQ7xLkmg7kPqBH5t3T6dCAPHAax+Puc6QZioEHBiIYb1zoluiAC0Uj8vVY2R86ikI0uflUY0+YWIpH2jgaez+CD8Uik0NkgXyBjCxjMlm+jWR7hk-UuLVULThEzCEVJaOaGNkBFk6lOciyl3BwPUPiBWXpBMIMzmC2WYFWzN+rP82QIrH62RhF28CH8oyeQA */
  id: 'counter',
  initial: 'green',
  context: {
    cycles: 0
  },
  states: {
    green: {
      on: {
        TIMER: 'yellow'
      }
    },
    yellow: {
      on: {
        TIMER: 'red'
      }
    },
    red: {
      on: {
        TIMER: {
          target: 'green',
          actions: assign({
            cycles: ({ context }) => context.cycles + 1
          })
        }
      }
    }
  }
});
