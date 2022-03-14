import { nanoid } from 'nanoid';
import type { Machine } from './machine';

type Test<TA = any, TC = any> = { invite?: string; args: TA } & (
  | { expected: TC; enteredStates?: (string | undefined)[] }
  | { expected?: TC; enteredStates: (string | undefined)[] }
);

type Props<
  TA = any,
  TC extends Record<string, unknown> = Record<string, unknown>
> = {
  machine: Machine<TA, TC>;
  tests: Test<TA, TC>[];
  // invite?: string;
  timeout?: number;
};

function constructInvite(invite = nanoid()) {
  return `${invite} ==>`;
}

function testCase<
  TA = any,
  TC extends Record<string, unknown> = Record<string, unknown>
>(
  machine: Machine<TA, TC>,
  { invite, args, expected, enteredStates }: Test<TA, TC>,
  timeout: number
) {
  describe(constructInvite(invite), () => {
    !!expected &&
      test(
        'Result matches expected',
        async () => {
          const _machine = machine.cloneTest;
          const received = await _machine.startAsync(args);
          expect(received).toStrictEqual(expected);
        },
        timeout
      );
    !!enteredStates &&
      test(
        'STATES match expecteds',
        async () => {
          const _machine = machine.cloneTest;
          await _machine.startAsync(args);
          expect(_machine.enteredStates).toStrictEqual(enteredStates);
        },
        timeout
      );
  });
}

export function testMachine<
  TA = any,
  TC extends Record<string, unknown> = Record<string, unknown>
>({ machine, tests, timeout = 3500 }: Props<TA, TC>) {
  // for (const test of tests) {
  //   testCase(machine, test, timeout);
  // }
  tests.forEach((test) => testCase(machine, test, timeout));
}
