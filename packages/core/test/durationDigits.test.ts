import {
  createMachine,
  initialTransition,
  machineFromJSON
} from '../src/index.ts';
import { parseDurationToMilliseconds } from '../src/delay.ts';

it.each(['s', '.s', ' S ', ' .S '])(
  'rejects a seconds duration without digits: %s',
  (duration) => {
    expect(parseDurationToMilliseconds(duration)).toBeUndefined();

    expect(() =>
      initialTransition(
        createMachine({
          initial: 'waiting',
          states: {
            waiting: { after: { [duration]: { target: 'done' } } },
            done: {}
          }
        })
      )
    ).toThrow();
  }
);

it.each([
  ['0s', 0],
  ['.0s', 0],
  ['0.s', 0],
  ['5s', 5000],
  ['1.5s', 1500],
  ['.5s', 500],
  ['1.s', 1000],
  [' 1.025S ', 1025],
  ['250ms', 250],
  ['PT1M30S', 90000]
] as const)('preserves a numeric duration: %s', (duration, expected) => {
  expect(parseDurationToMilliseconds(duration)).toBe(expected);
});

it('preserves a configured delay whose name has no digits', () => {
  const [snapshot, effects] = initialTransition(
    createMachine({
      delays: { s: 250 },
      initial: 'waiting',
      states: {
        waiting: { after: { s: { target: 'done' } } },
        done: {}
      }
    })
  );

  expect(snapshot.status).toBe('active');
  expect(effects).toHaveLength(1);
  expect(effects[0]).toMatchObject({ type: '@xstate.raise', delay: 250 });
});

it.each(['s', '.s', 'namedDelay'])(
  'loads a configured zero delay from JSON: %s',
  (delay) => {
    for (const inline of [false, true]) {
      const [snapshot, effects] = initialTransition(
        machineFromJSON(
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
