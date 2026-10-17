import {
  createAsyncLogic,
  setup,
  types,
  type OutputFrom
} from '../src/index.ts';
import { standardSchemaValidator } from '../src/validation/index.ts';

type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
function expectTrue<_T extends true>() {}

type Outcome =
  | { readonly kind: 'a' }
  | { readonly kind: 'b'; readonly n: number };
const outcome = types<Outcome>();

const load = createAsyncLogic({
  schemas: { input: types<{ id: string }>(), output: outcome },
  run: async (): Promise<Outcome> => ({ kind: 'a' })
});

const machine = setup({
  validator: standardSchemaValidator(),
  schemas: { context: types<{ n: number }>(), events: { go: types<{}>() } },
  actors: { load }
}).createMachine({
  context: { n: 0 },
  initial: 'loading',
  states: {
    loading: {
      invoke: {
        src: 'load',
        input: () => ({ id: 'a' }),
        onDone: () => ({ target: 'done' })
      }
    },
    done: {}
  }
});

describe('createAsyncLogic with schemas.output (#5802)', () => {
  it('keeps a literal returned by run', () => {
    const logic = createAsyncLogic({
      schemas: { input: types<unknown>(), output: outcome },
      run: async () => ({ kind: 'a' })
    });
    expectTrue<Equals<OutputFrom<typeof logic>, Outcome>>();
  });

  it('keeps a literal returned by run with an output-only schema', () => {
    const logic = createAsyncLogic({
      schemas: { output: outcome },
      run: async () => ({ kind: 'b', n: 1 })
    });
    expectTrue<Equals<OutputFrom<typeof logic>, Outcome>>();
  });

  it('keeps a literal returned by a run that reads its input', () => {
    createAsyncLogic({
      schemas: { input: types<{ id: string }>(), output: outcome },
      run: async ({ input }) => (input.id ? { kind: 'a' } : { kind: 'b', n: 1 })
    });
  });

  it('accepts mutable array outputs', () => {
    createAsyncLogic({
      schemas: { output: types<{ items: string[] }>() },
      run: async () => ({ items: ['a'] })
    });
    createAsyncLogic({
      schemas: {
        input: types<{ id: string }>(),
        output: types<{ items: string[] }>()
      },
      run: async () => ({ items: ['a'] })
    });
  });

  it('accepts a literal replacement in provide()', () => {
    machine.provide({
      actors: {
        load: createAsyncLogic({
          schemas: { input: types<unknown>(), output: outcome },
          run: async () => ({ kind: 'a' })
        })
      }
    });
  });

  it('accepts a nullish fallback to a literal in provide()', () => {
    const queued: Outcome[] = [];
    machine.provide({
      actors: {
        load: createAsyncLogic({
          schemas: { input: types<unknown>(), output: outcome },
          run: async () => queued.pop() ?? { kind: 'a' }
        })
      }
    });
  });

  it('accepts an annotated run in provide()', () => {
    machine.provide({
      actors: {
        load: createAsyncLogic({
          schemas: { input: types<unknown>(), output: outcome },
          run: async (): Promise<Outcome> => ({ kind: 'a' })
        })
      }
    });
  });

  it('rejects a run whose output does not match schemas.output', () => {
    createAsyncLogic({
      schemas: { input: types<unknown>(), output: outcome },
      // @ts-expect-error '{ kind: "c" }' is not assignable to 'Outcome'
      run: async () => ({ kind: 'c' })
    });
    createAsyncLogic({
      schemas: { output: outcome },
      // @ts-expect-error '{ kind: "c" }' is not assignable to 'Outcome'
      run: async () => ({ kind: 'c' })
    });
  });

  it('still widens schema-free outputs', () => {
    const save = createAsyncLogic({ run: async () => ({ ok: true }) });
    expectTrue<Equals<OutputFrom<typeof save>, { ok: boolean }>>();
    const m = setup({ actors: { save } }).createMachine({});
    m.provide({
      actors: { save: createAsyncLogic({ run: async () => ({ ok: false }) }) }
    });
  });
});
