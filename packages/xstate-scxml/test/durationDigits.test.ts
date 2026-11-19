import { expect, it } from 'vitest';
import { initialTransition } from 'xstate';
import { createMachineFromSCXMLConfig } from '../src/runtime.ts';

it.each(['s', '.s', 'namedDelay'])(
  'loads a configured zero delay from SCXML config: %s',
  (delay: string) => {
    for (const inline of [false, true]) {
      const [snapshot, effects] = initialTransition(
        createMachineFromSCXMLConfig(
          {
            ...(inline ? { delays: { [delay]: 0 } } : {}),
            initial: 'waiting',
            states: {
              waiting: { after: { [delay]: { target: 'done' } } },
              done: {}
            }
          },
          inline ? {} : { delays: { [delay]: 0 } }
        )
      );

      expect(snapshot.status).toBe('active');
      expect(effects).toHaveLength(1);
      expect(effects[0]).toMatchObject({ type: '@xstate.raise', delay: 0 });
    }
  }
);

it('still rejects an empty SCXML delay descriptor', () => {
  expect(() =>
    createMachineFromSCXMLConfig({
      delays: { namedDelay: '' },
      initial: 'waiting',
      states: {
        waiting: { after: { namedDelay: { target: 'done' } } },
        done: {}
      }
    })
  ).toThrow();
});
