import { setup, types } from '../src/index.ts';

it('requires ancestor context when targeting descendants', () => {
  setup({
    schemas: {
      context: types<{ id: string | null }>(),
      events: {
        GO: types<{}>(),
        MISSING: types<{}>(),
        ID: types<{}>(),
        ID_MISSING: types<{}>(),
        VALID: types<{}>(),
        VALID_ID: types<{}>(),
        VALID_PARENT: types<{}>(),
        PARENT: types<{}>()
      }
    },
    states: {
      idle: { schemas: { context: types<{ id: null }>() } },
      active: {
        schemas: { context: types<{ id: string }>() },
        states: { running: { id: 'runningId' } }
      }
    }
  }).createMachine({
    context: { id: null },
    initial: 'idle',
    states: {
      idle: {
        on: {
          // @ts-expect-error parent requires string
          PARENT: () => ({ target: 'active', context: { id: null } }),
          // @ts-expect-error descendant inherits string requirement
          GO: () => ({ target: 'active.running', context: { id: null } }),
          // @ts-expect-error descendant requires patch
          MISSING: () => ({ target: 'active.running' }),
          // @ts-expect-error declared id inherits ancestor requirement
          ID: () => ({ target: '#runningId', context: { id: null } }),
          // @ts-expect-error declared id requires patch
          ID_MISSING: () => ({ target: '#runningId' }),
          VALID: () => ({ target: 'active.running', context: { id: 'ok' } }),
          VALID_ID: () => ({ target: '#runningId', context: { id: 'ok' } }),
          VALID_PARENT: () => ({ target: 'active', context: { id: 'ok' } })
        }
      },
      active: {
        on: {
          // @ts-expect-error relative descendants retain the source ancestor refinement
          GO: () => ({ target: '.running', context: { id: null } }),
          MISSING: () => ({ target: '.running' })
        },
        initial: 'running',
        states: {
          running: {
            id: 'runningId',
            on: { GO: () => ({ target: '#runningId' }) }
          }
        }
      }
    }
  });
});
