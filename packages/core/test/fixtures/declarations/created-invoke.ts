/* oxlint-disable typescript/require-await -- Exercise inference from plain async return values. */
import {
  createAsyncLogic,
  setup,
  types,
  type ActorRefFromLogic
} from '../../../src/index.ts';

const s = setup({
  schemas: {
    context: types<{ userId: string | undefined; name: string }>()
  },
  actors: { other: createAsyncLogic({ run: async () => 42 }) },
  states: {
    loading: { schemas: { context: types<{ userId: string }>() } },
    ready: {}
  }
});

export const invoke = s.createInvoke({
  src: createAsyncLogic({ run: async () => ({ name: 'David' }) }),
  onDone: ({ event }) => ({ context: { name: event.output.name } })
});

export const machine = s.createMachine({
  context: { userId: '123', name: '' },
  initial: 'loading',
  states: {
    loading: {
      invoke: s.createInvoke({
        src: createAsyncLogic({
          schemas: { input: types<{ userId: string }>() },
          run: async ({ input }) => ({ name: input.userId })
        }),
        input: ({ context }) => ({ userId: context.userId }),
        onDone: ({ event }) => ({
          target: 'ready',
          context: { name: event.output.name }
        })
      })
    },
    ready: {}
  }
});

const mapperSetup = setup({
  schemas: { context: types<{ name: string }>() },
  states: {
    loading: {},
    ready: { schemas: { input: types<{ name: string }>() } }
  }
});

// Exported object-form handlers must not retain private callback argument types.
export const mappedInvoke = mapperSetup.createInvoke({
  src: createAsyncLogic({ run: async () => ({ name: 'David' }) }),
  onDone: {
    target: 'ready',
    input: ({ event }) => ({ name: event.output.name }),
    context: ({ event }) => ({ name: event.output.name })
  }
});

const job = createAsyncLogic({
  schemas: { input: types<{ id: number }>() },
  run: async ({ input }) => input.id
});
const childSetup = setup({});
export const hoistedChild = childSetup.createInvoke({
  id: 'job',
  src: job,
  input: { id: 1 }
});
export const machineWithChildren = childSetup.createMachine({
  schemas: { children: { job: types<ActorRefFromLogic<typeof job>>() } },
  invoke: hoistedChild
});
export const inlineMachineWithChildren = childSetup.createMachine({
  schemas: { children: { job: types<ActorRefFromLogic<typeof job>>() } },
  invoke: childSetup.createInvoke({
    id: 'job',
    src: job,
    input: { id: 1 },
    onDone: ({ event }) => ({ context: { result: event.output } })
  })
});
