import { StateMachine } from './StateMachine';
import type {
  ActorMap,
  BaseActionObject,
  BaseGuardDefinition,
  DelayConfig,
  EventObject,
  Get,
  IsNever,
  MachineContext,
  Values
} from './types';

export interface PartialMachineTypes {
  input?: {};
  context?: MachineContext;
  events?: EventObject;
  actions?: BaseActionObject;
  actors?: ActorMap;
  children?: ActorMap;
  guards?: BaseGuardDefinition;
  delays?: {
    [key: string]: DelayConfig<any, any>;
  };
}

type WithDefaultConstraint<
  T,
  TDefault,
  TConstraint = TDefault
> = unknown extends T ? TDefault : T extends TConstraint ? T : never;

type DoneInvokeEvents<T extends ActorMap | undefined> = T extends ActorMap
  ? Values<
      {
        [K in keyof T]:
          | {
              type: `done.invoke.${K & string}`;
              data: T[K]['data'];
            }
          | { type: `error.invoke.${K & string}`; data: unknown }
          | { type: `error.platform.${K & string}`; data: unknown } // TODO: deprecate?
          | { type: `xstate.snapshot.${K & string}`; data: T[K]['snapshot'] };
      }
    >
  : never;

type GetAllEvents<T extends PartialMachineTypes> =
  | WithDefaultConstraint<T['events'], never, EventObject>
  | (unknown extends T['input']
      ? never
      : {
          type: 'xstate.init';
          input: T['input'];
        })
  | DoneInvokeEvents<T['children']>;

type DefaultIfNever<T, TDefault> = IsNever<T> extends true ? TDefault : T;

// type PartialWildcards<T extends EventObject> = ValuesFrom<
//   {
//     [K in T['type']]: K extends `${infer A}.${infer B}`
//       ?
//           | {
//               type: `${A}.*`;
//               // TODO: add payload
//             }
//           | T
//       : T;
//   }
// >;

// type E = PartialWildcards<
//   { type: 'foo'; foo: number } | { type: 'bar.baz'; payload: number }
// >;

// type GetEvents<T extends PartialMachineTypes> = PartialWildcards<
//   DefaultIfNever<GetAllEvents<T>, EventObject>
// >;

type GetEvents<T extends PartialMachineTypes> = DefaultIfNever<
  GetAllEvents<T>,
  EventObject
>;

// type TestEventNothing = GetEvents<{}>;
// type TestEventInput = GetEvents<{ input: { foo: string } }>;
// type TestEventActors = GetEvents<{
//   children: { foo: { data: string }; bar: { data: number } };
// }>;
// type TestEventInputActors = GetEvents<{
//   input: { greeting: string };
//   children: { foo: { data: string }; bar: { data: number } };
// }>;
// type TestEventEverything = GetEvents<{
//   input: { greeting: string };
//   events: { type: 'a' } | { type: 'b'; params: any[] };
//   children: { foo: { data: string }; bar: { data: number } };
// }>;

export type MachineTypes<T extends PartialMachineTypes> = {
  input: WithDefaultConstraint<T['input'], undefined, MachineContext>;
  context: WithDefaultConstraint<T['context'], MachineContext>;
  events: GetEvents<T>;
  actions: WithDefaultConstraint<T['actions'], BaseActionObject>;
  actors: WithDefaultConstraint<T['actors'], ActorMap>;
  children: WithDefaultConstraint<T['children'], ActorMap>;
  guards: WithDefaultConstraint<T['guards'], BaseGuardDefinition>;
  delays: WithDefaultConstraint<
    T['delays'],
    Record<string, DelayConfig<any, any>>
  >;
};

export function createTypes<T extends PartialMachineTypes>(
  types: T
): MachineTypes<T> {
  return types as any;
}

type CheckInput<
  TT extends MachineTypes<any>,
  TProvided,
  TProvidedInput = Get<TProvided, 'input'>
> = TT['input'] extends undefined
  ? never
  : {} extends TT['input']
  ? never
  : TProvidedInput extends TT['input']
  ? never
  : 'Missing `input`';

export type GetValidityErrors<T> = T extends StateMachine<
  infer _TC,
  infer _TE,
  infer _TA,
  infer _TAc,
  infer _TR,
  infer TT,
  infer TProvided
>
  ? // TODO: more validation can be added here, like CheckActions, CheckGuards, etc.
    CheckInput<TT, TProvided>
  : never;
