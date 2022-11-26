import { StateMachine } from './StateMachine';
import type {
  BaseActionObject,
  BaseGuardDefinition,
  DelayConfig,
  EventObject,
  Get,
  IsNever,
  MachineConfig2,
  MachineContext
} from './types';

export interface PartialMachineTypes {
  input?: {};
  context?: MachineContext;
  events?: EventObject;
  actions?: BaseActionObject;
  actors?: ActorInfo;
  children?: ChildInfo;
  guards?: BaseGuardDefinition;
  delays?: {
    [key: string]: DelayConfig<any, any>;
  };
}

export interface ActorInfo {
  src: string;
  data: any;
}

export interface ChildInfo {
  id: string;
  snapshot: any;
}

type WithDefaultConstraint<
  T,
  TDefault,
  TConstraint = TDefault
> = unknown extends T ? TDefault : T extends TConstraint ? T : never;

type DoneInvokeEvents<
  TTypes extends PartialMachineTypes
> = TTypes['children'] extends ChildInfo
  ? TTypes['children']['id'] extends infer K
    ?
        | {
            type: `done.invoke.${K & string}`;
            data: (TTypes['children'] & { id: K })['snapshot'];
          }
        | { type: `error.invoke.${K & string}`; data: unknown }
        | { type: `error.platform.${K & string}`; data: unknown } // TODO: deprecate?
        | {
            type: `xstate.snapshot.${K & string}`;
            data: (TTypes['children'] & { id: K })['snapshot'];
          }
    : never
  : never;

type AllEvents<TPartialTypes extends PartialMachineTypes> =
  | WithDefaultConstraint<TPartialTypes['events'], never, EventObject>
  | (unknown extends TPartialTypes['input']
      ? never
      : {
          type: 'xstate.init';
          input: TPartialTypes['input'];
        })
  | DoneInvokeEvents<TPartialTypes>;

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

type GetAllEvents<T extends PartialMachineTypes> = DefaultIfNever<
  AllEvents<T>,
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
  events: WithDefaultConstraint<T['events'], EventObject>;
  /**
   * All events, including special events (done.*, error.*, xstate.init, xstate.snapshot.*)
   */
  allEvents: GetAllEvents<T>;
  actions: WithDefaultConstraint<T['actions'], BaseActionObject>;
  actors: WithDefaultConstraint<T['actors'], ActorInfo>;
  children: WithDefaultConstraint<T['children'], ChildInfo>;
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
