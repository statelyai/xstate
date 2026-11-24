import { createAsyncLogic, setup, types } from '../src/index.ts';

it('preserves created invoke context patches for refined array targets', () => {
  const work = createAsyncLogic({ run: async () => 42 });
  const s = setup({
    schemas: { context: types<{ id: string | null }>() },
    states: {
      idle: {},
      active: {
        schemas: { context: types<{ id: string }>() },
        states: { running: {} }
      }
    }
  });
  s.createMachine({
    context: { id: null },
    initial: 'idle',
    states: {
      idle: {
        invoke: s.createInvoke({
          src: work,
          onDone: { target: ['active.running'], context: { id: 'ok' } }
        })
      },
      active: { initial: 'running', states: { running: {} } }
    }
  });
  s.createMachine({
    context: { id: null },
    initial: 'idle',
    states: {
      idle: {
        invoke: s.createInvoke({
          src: work,
          onDone: { target: ['active.running'], context: () => ({ id: 'ok' }) }
        })
      },
      active: { initial: 'running', states: { running: {} } }
    }
  });
  s.createMachine({
    context: { id: null },
    initial: 'idle',
    states: {
      idle: {
        // @ts-expect-error entering the refined state requires a patch
        invoke: s.createInvoke({
          src: work,
          onDone: { target: ['active.running'] }
        })
      },
      active: { initial: 'running', states: { running: {} } }
    }
  });
  s.createMachine({
    context: { id: null },
    initial: 'idle',
    states: {
      idle: {
        // @ts-expect-error a supplied patch must satisfy the destination refinement
        invoke: s.createInvoke({
          src: work,
          onDone: { target: ['active.running'], context: { id: null } }
        })
      },
      active: { initial: 'running', states: { running: {} } }
    }
  });
});
