import type { EventObject, IsAny, NormalizeDescriptor } from './types.ts';

type EventTypeMatchesDescriptor<
  TEventType extends string,
  TDescriptor extends string
> = TEventType extends NormalizeDescriptor<TDescriptor> ? true : false;

type IsInternalEventType<
  TEventType extends string,
  TDescriptors extends string
> =
  // Descriptors that collapsed to broad `string` (an untyped machine's
  // config) cannot classify anything: without the guard they would match
  // every event type and reduce the sendable events to `never`.
  string extends TDescriptors
    ? false
    : true extends (
          TDescriptors extends any
            ? EventTypeMatchesDescriptor<TEventType, TDescriptors>
            : never
        )
      ? true
      : false;

type ExcludeInternalEvents<
  TEvent extends EventObject,
  TDescriptors extends string
> = TEvent extends any
  ? IsInternalEventType<TEvent['type'], TDescriptors> extends true
    ? never
    : TEvent
  : never;

type InternalEventTypes<TInternalEvent extends EventObject> =
  TInternalEvent extends any ? TInternalEvent['type'] : never;

export type SendableEventFromMachine<
  TEvent extends EventObject,
  TInternalEvent extends EventObject
> =
  IsAny<TInternalEvent> extends true
    ? TEvent
    : ExcludeInternalEvents<TEvent, InternalEventTypes<TInternalEvent>>;

export type PublicEventFromMachine<
  TEvent extends EventObject,
  TInternalEvent extends EventObject
> =
  SendableEventFromMachine<TEvent, TInternalEvent> extends infer TPublic
    ? TPublic extends EventObject
      ? TPublic['type'] extends 'xstate.route'
        ? TPublic
        : TPublic['type'] extends `xstate.${string}` | `@xstate.${string}`
          ? never
          : TPublic
      : never
    : never;
