import * as fc from 'fast-check';
import { createMachine, types } from 'xstate';
import { createTestModel, propertyTest } from 'xstate/graph';
import { expectTypeOf, it } from 'vitest';
import { fastCheckAdapter } from '../src/index.ts';

const machine = createMachine({
  schemas: {
    context: types<{ count: number }>(),
    events: {
      INC: types<{ value: number }>(),
      RESET: types<{}>()
    }
  },
  context: { count: 0 },
  on: {
    INC: ({ context, event }) => ({
      context: { count: context.count + event.value }
    })
  }
});

it('infers machine and TestModel property APIs', () => {
  if (false) {
    void propertyTest(machine, {
      adapter: fastCheckAdapter(),
      events: {
        INC: fc.record({ value: fc.integer() }),
        RESET: fc.constant({})
      },
      commands: {
        advance: fc.nat(),
        checkpoint: fc.record({ label: fc.string() }),
        stop: fc.constant({})
      },
      invariant: ({ snapshot, event }) => {
        expectTypeOf(snapshot.context.count).toEqualTypeOf<number>();
        expectTypeOf(event).toMatchTypeOf<
          { type: 'INC'; value: number } | { type: 'RESET' } | undefined
        >();
      },
      reference: {
        create: () => ({
          transition: (event) => {
            expectTypeOf(event).toMatchTypeOf<
              { type: 'INC'; value: number } | { type: 'RESET' }
            >();
          },
          read: () => 0
        }),
        projectModel: (snapshot) => snapshot.context.count
      }
    });

    void propertyTest(createTestModel(machine), {
      adapter: fastCheckAdapter(),
      events: { INC: fc.record({ value: fc.integer() }) },
      invariant: ({ snapshot }) => {
        expectTypeOf(snapshot.context.count).toEqualTypeOf<number>();
      }
    });

    void propertyTest(machine, {
      adapter: fastCheckAdapter(),
      events: {
        // @ts-expect-error payload generators must match the keyed event
        INC: fc.record({ value: fc.string() })
      },
      invariant: () => {}
    });
  }
});
