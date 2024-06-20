import { EventObject, ParameterizedObject, ProvidedActor } from './types.ts';

/**
 * @deprecated
 */
export interface TypegenDisabled {
  '@@xstate/typegen': false;
}

/**
 * @deprecated
 */
export interface TypegenEnabled {
  '@@xstate/typegen': true;
}

export interface StateMachineTypes {
  events: EventObject;
  actors: ProvidedActor;
  actions: ParameterizedObject;
  guards: ParameterizedObject;
  delays: string;
  tags: string;
  emitted: EventObject;
}

/**
 * @deprecated
 */
export interface ResolveTypegenMeta<
  TEvent extends EventObject,
  TActor extends ProvidedActor,
  TAction extends ParameterizedObject,
  TGuard extends ParameterizedObject,
  TDelay extends string,
  TTag extends string,
  TEmitted extends EventObject = EventObject
> {
  events: TEvent;
  actors: TActor;
  actions: TAction;
  guards: TGuard;
  delays: TDelay;
  tags: TTag;
  emitted: TEmitted;
}
