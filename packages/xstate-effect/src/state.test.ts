import { Effect, Match, Schema, Stream } from 'effect';
import { createActor, createMachine } from 'xstate';
import {
  createEffectActor,
  send,
  setupEffect,
  snapshots,
  taggedState,
  type TaggedState,
  type TaggedStateFrom
} from './index.ts';

const machine = setupEffect({
  schemas: {
    context: Schema.Struct({ id: Schema.String }),
    events: {
      START: Schema.Struct({}),
      DONE: Schema.Struct({}),
      FAIL: Schema.Struct({})
    }
  },
  states: {
    idle: {},
    loading: {
      schemas: {
        context: Schema.Struct({ startedAt: Schema.Number })
      }
    },
    done: {
      states: {
        success: {},
        failure: {}
      }
    },
    failed: {}
  }
}).createMachine({
  context: { id: 'a' },
  initial: 'idle',
  states: {
    idle: {
      on: {
        START: ({ context }) => ({
          target: 'loading',
          context: { ...context, startedAt: 1 }
        })
      }
    },
    loading: {
      on: { DONE: { target: 'done' }, FAIL: { target: 'failed' } }
    },
    done: {
      initial: 'success',
      states: {
        success: {},
        failure: {}
      }
    },
    failed: {}
  }
});

const parallelMachine = createMachine({
  type: 'parallel',
  states: {
    a: { initial: 'a1', states: { a1: {}, a2: {} } },
    b: { initial: 'b1', states: { b1: {} } }
  }
});

const describeState = Match.type<TaggedState<typeof machine>>().pipe(
  Match.tag('idle', () => 'idle'),
  Match.tag('loading', ({ context }) => `loading since ${context.startedAt}`),
  Match.tag('done.success', 'done.failure', 'failed', ({ _tag }) => _tag),
  Match.exhaustive
);

describe('taggedState', () => {
  it('tags the state path and keeps the per-state context', () => {
    const actor = createActor(machine).start();
    const idle = taggedState(actor.getSnapshot());
    expect(idle._tag).toBe('idle');
    expect(idle.value).toBe('idle');

    actor.send({ type: 'START' });
    const loading = taggedState(actor.getSnapshot());
    expect(loading._tag).toBe('loading');
    expect(loading.context).toEqual({ id: 'a', startedAt: 1 });

    actor.send({ type: 'DONE' });
    const done = taggedState(actor.getSnapshot());
    expect(done._tag).toBe('done.success');
    expect(done.value).toEqual({ done: 'success' });
    expect(done.snapshot).toBe(actor.getSnapshot());
  });

  it('stops at a parallel state', () => {
    const actor = createActor(parallelMachine).start();
    const tagged = taggedState(actor.getSnapshot());
    expect(tagged._tag).toBe('(machine)');
    expect(tagged.value).toEqual({ a: 'a1', b: 'b1' });
  });

  it('matches exhaustively over snapshots of an Effect actor', async () => {
    const program = Effect.gen(function* () {
      const actor = yield* createEffectActor(machine);
      const seen = yield* snapshots(actor).pipe(
        Stream.map(taggedState),
        Stream.tap(({ _tag }) =>
          _tag === 'idle'
            ? send(actor, { type: 'START' })
            : _tag === 'loading'
              ? send(actor, { type: 'FAIL' })
              : Effect.void
        ),
        Stream.map(describeState),
        Stream.take(3),
        Stream.runCollect
      );
      return [...seen];
    });

    await expect(Effect.runPromise(Effect.scoped(program))).resolves.toEqual([
      'idle',
      'loading since 1',
      'failed'
    ]);
  });

  it('types the tag union and per-state context', () => {
    type Tagged = TaggedState<typeof machine>;
    type Tags = Tagged['_tag'];
    'idle' satisfies Tags;
    'loading' satisfies Tags;
    'done.success' satisfies Tags;
    'done.failure' satisfies Tags;
    'failed' satisfies Tags;
    // @ts-expect-error - not a leaf state of this machine
    'done' satisfies Tags;

    const check = (tagged: Tagged) => {
      if (tagged._tag === 'loading') {
        tagged.context.startedAt satisfies number;
        tagged.value satisfies 'loading';
      }
    };
    check(taggedState(createActor(machine).getSnapshot()));

    type Parallel = TaggedStateFrom<
      ReturnType<typeof parallelMachine.getInitialSnapshot>
    >;
    '(machine)' satisfies Parallel['_tag'];
  });
});
