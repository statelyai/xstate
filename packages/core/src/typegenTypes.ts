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

export interface Stuff {
  TEvent: EventObject;
  TActor: ProvidedActor;
  TAction: ParameterizedObject;
  TGuard: ParameterizedObject;
  TDelay: string;
  TTag: string;
  TEmitted: EventObject;
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
  TEvent: TEvent;
  TActor: TActor;
  TAction: TAction;
  TGuard: TGuard;
  TDelay: TDelay;
  TTag: TTag;
  TEmitted: TEmitted;
}
