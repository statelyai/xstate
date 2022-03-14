import { Machine } from './machine';
import { StateDefinition } from './types';

type ReturnType<
  TA = any,
  TC extends Record<string, unknown> = Record<string, unknown>,
  S extends StateDefinition<TA, TC> = StateDefinition<TA, TC>
> = 'async' extends S['type'] ? (args: TA) => Promise<TC> : (args: TA) => TC;

export function serve<
  TA = any,
  TC extends Record<string, unknown> = Record<string, unknown>,
  S extends StateDefinition<TA, TC> = StateDefinition<TA, TC>
>(machine: Machine<TA, TC, S>): ReturnType<TA, TC, S> {
  const _machine = machine.clone;
  const checkAsync = _machine._states.some((state) => state.type === 'async');
  return (checkAsync ? _machine.startAsync : _machine.start) as ReturnType<
    TA,
    TC,
    S
  >;
}

// type ReturnType2<T extends Machine> =
//   'async' extends T['_states'][number]['type']
//     ? (args: GetTA<T>) => Promise<GetTC<T>>
//     : (args: GetTA<T>) => GetTC<T>;

// export function serve2<T extends Machine>(machine: T): ReturnType2<T> {
//   const checkAsync = machine._states.some(state => state.type === 'async');
//   return (
//     checkAsync ? machine.startAsync : machine.start
//   ) as ReturnType2<T>;
// }
