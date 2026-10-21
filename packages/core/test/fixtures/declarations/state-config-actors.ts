import { createAsyncLogic, setup, types } from '../../../src/index.ts';

// A setup() with a registered actor, and a createStateConfig() callback that
// takes a parameter. The callback's `actors` arg type (CallbackActors<...>)
// used to carry an unexported `unique symbol` key, which made declaration
// emit fail with TS4023 on any such exported state config.
const base = setup({
  schemas: { context: types<{ attempts: number }>() },
  actors: { check: createAsyncLogic({ run: () => Promise.resolve(true) }) }
});

export const idle = base.createStateConfig({
  on: {
    RETRY: ({ context }) => ({
      target: 'checking',
      context: { attempts: context.attempts + 1 }
    })
  }
});
