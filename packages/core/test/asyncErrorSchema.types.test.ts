import { z } from 'zod';
import {
  createActor,
  createAsyncLogic,
  setup,
  type ErrorFrom
} from '../src/index.ts';

function expectType<T>(_v: T) {}

const withError = createAsyncLogic({
  schemas: {
    output: z.object({ name: z.string() }),
    error: z.object({ code: z.string() })
  },
  run: async () => ({ name: 'David' })
});

const withoutError = createAsyncLogic({
  schemas: { output: z.object({ name: z.string() }) },
  run: async () => ({ name: 'David' })
});

describe('async logic `schemas.error`', () => {
  it('types `event.error` in the invoking `onError`', () => {
    setup({ actors: { withError } }).createMachine({
      invoke: {
        src: 'withError',
        onError: ({ event }) => {
          expectType<string>(event.error.code);
        }
      }
    });

    setup({ actors: { withoutError } }).createMachine({
      invoke: {
        src: 'withoutError',
        onError: ({ event }) => {
          // @ts-expect-error - error is `unknown` without an error schema
          event.error.code;
        }
      }
    });

    expect(true).toBe(true);
  });

  it('types the error snapshot field', () => {
    expectType<{ code: string }>({} as ErrorFrom<typeof withError>);

    const snapshot = createActor(withError).getSnapshot();
    if (snapshot.status === 'error') {
      expectType<string>(snapshot.error.code);
    }

    const other = createActor(withoutError).getSnapshot();
    if (other.status === 'error') {
      // @ts-expect-error - error is `unknown` without an error schema
      other.error.code;
    }

    expect(true).toBe(true);
  });

  it('accepts error-only and input + error schemas', () => {
    const errorOnly = createAsyncLogic({
      schemas: { error: z.object({ code: z.string() }) },
      run: async () => 42
    });
    expectType<{ code: string }>({} as ErrorFrom<typeof errorOnly>);

    const inputAndError = createAsyncLogic({
      schemas: {
        input: z.object({ id: z.string() }),
        error: z.object({ code: z.string() })
      },
      run: async ({ input }) => input.id
    });
    expectType<{ code: string }>({} as ErrorFrom<typeof inputAndError>);

    expect(true).toBe(true);
  });
});
