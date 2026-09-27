import type { EventFrom, SnapshotFrom } from '../../../src/index.ts';
import type { parentMachine } from './registered-child-parent.d.ts';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
type Expect<T extends true> = T;

type ParentEvent = EventFrom<typeof parentMachine>['type'];
type ParentState = SnapshotFrom<typeof parentMachine>['value'];

type _Events = Expect<
  Equal<
    ParentEvent,
    'e0' | 'e1' | 'e2' | 'e3' | 'e4' | 'e5' | 'e6' | 'e7' | 'e8' | 'e9' | 'e10'
  >
>;
type _States = Expect<Equal<ParentState, 's0' | 's1'>>;
