import { StateMachine } from './StateMachine';
import { createMachine } from './createMachine';
import { GuardPredicate } from './guards';
import { assign } from './actions/assign';
import { sendTo, sendParent, forwardTo } from './actions/send';
import { raise } from './actions/raise';
import { log } from './actions/log';
import { stopChild } from './actions/stopChild';
import { cancel } from './actions/cancel';

import {
  ActionFunction,
  ActionArgs,
  AnyActorRef,
  AnyEventObject,
  Cast,
  DelayConfig,
  EventObject,
  Assigner,
  PropertyAssigner,
  LowInfer,
  DoNotInfer,
  SendExpr,
  RaiseActionOptions,
  EventFrom,
  InferEvent,
  SendToActionOptions,
  LogExpr,
  Invert,
  IsNever,
  MachineConfig,
  MachineContext,
  MetaObject,
  NonReducibleUnknown,
  ParameterizedObject,
  SetupTypes,
  StateNodeConfig,
  ToChildren,
  ToStateValue,
  UnknownActorLogic,
  Values
} from './types';

type ToParameterizedObject<
  TParameterizedMap extends Record<
    string,
    ParameterizedObject['params'] | undefined
  >
> = // `silentNeverType` to `never` conversion (explained in `ToProvidedActor`)
  IsNever<TParameterizedMap> extends true
    ? never
    : Values<{
        [K in keyof TParameterizedMap & string]: {
          type: K;
          params: TParameterizedMap[K];
        };
      }>;

// at the moment we allow extra actors - ones that are not specified by `children`
// this could be reconsidered in the future
type ToProvidedActor<
  TChildrenMap extends Record<string, string>,
  TActors extends Record<string, UnknownActorLogic>
> =
  // this essentially is meant to convert a leaked `silentNeverType` to the true `never` type
  // it shouldn't be observable but here we are
  // we don't want to lock inner inferences for our actions with types containing this type
  // it's used in inner inference contexts when the outer one context doesn't have inference candidates for a type parameter
  // because it leaks here, without this condition it manages to create an inferable type that contains it
  // the `silentNeverType` is non-inferable itself and that usually means that a containing object is non-inferable too
  // that doesn't happen here though. However, we actually want to infer a true `never` here so our actions can't use unknown actors
  // for that reason it's important to do the conversion here because we want to map it to something that is actually inferable
  IsNever<TActors> extends true
    ? never
    : Values<{
        [K in keyof TActors & string]: {
          src: K;
          logic: TActors[K];
          id: IsNever<TChildrenMap> extends true
            ? string | undefined
            : K extends keyof Invert<TChildrenMap>
              ? Invert<TChildrenMap>[K] & string
              : string | undefined;
        };
      }>;

type RequiredSetupKeys<TChildrenMap> =
  IsNever<keyof TChildrenMap> extends true ? never : 'actors';

export function setup<
  TContext extends MachineContext,
  TEvent extends AnyEventObject, // TODO: consider using a stricter `EventObject` here
  TActors extends Record<string, UnknownActorLogic> = {},
  TChildrenMap extends Record<string, string> = {},
  TActions extends Record<
    string,
    ParameterizedObject['params'] | undefined
  > = {},
  TGuards extends Record<
    string,
    ParameterizedObject['params'] | undefined
  > = {},
  TDelay extends string = never,
  TTag extends string = string,
  TInput = NonReducibleUnknown,
  TOutput extends NonReducibleUnknown = NonReducibleUnknown,
  TEmitted extends EventObject = EventObject,
  TMeta extends MetaObject = MetaObject
>({
  schemas,
  actors,
  actions,
  guards,
  delays
}: {
  schemas?: unknown;
  types?: SetupTypes<
    TContext,
    TEvent,
    TChildrenMap,
    TTag,
    TInput,
    TOutput,
    TEmitted,
    TMeta
  >;
  actors?: {
    // union here enforces that all configured children have to be provided in actors
    // it makes those values required here
    [K in keyof TActors | Values<TChildrenMap>]: K extends keyof TActors
      ? TActors[K]
      : never;
  };
  actions?: {
    [K in keyof TActions]: ActionFunction<
      TContext,
      TEvent,
      TEvent,
      TActions[K],
      ToProvidedActor<TChildrenMap, TActors>,
      ToParameterizedObject<TActions>,
      ToParameterizedObject<TGuards>,
      TDelay,
      TEmitted
    >;
  };
  guards?: {
    [K in keyof TGuards]: GuardPredicate<
      TContext,
      TEvent,
      TGuards[K],
      ToParameterizedObject<TGuards>
    >;
  };
  delays?: {
    [K in TDelay]: DelayConfig<
      TContext,
      TEvent,
      ToParameterizedObject<TActions>['params'],
      TEvent
    >;
  };
} & {
  [K in RequiredSetupKeys<TChildrenMap>]: unknown;
}): {
  /**
   * Creates a state config that is strongly typed. This state config can be
   * used to create a machine.
   *
   * @example
   *
   * ```ts
   * const lightMachineSetup = setup({
   *   // ...
   * });
   *
   * const green = lightMachineSetup.createStateConfig({
   *   on: {
   *     timer: {
   *       actions: 'doSomething'
   *     }
   *   }
   * });
   *
   * const machine = lightMachineSetup.createMachine({
   *   initial: 'green',
   *   states: {
   *     green,
   *     yellow,
   *     red
   *   }
   * });
   * ```
   */
  createStateConfig: <
    TStateConfig extends StateNodeConfig<
      TContext,
      TEvent,
      ToProvidedActor<TChildrenMap, TActors>,
      ToParameterizedObject<TActions>,
      ToParameterizedObject<TGuards>,
      TDelay,
      TTag,
      unknown,
      TEmitted,
      TMeta
    >
  >(
    config: TStateConfig
  ) => TStateConfig;
  /**
   * Creates a type-safe action.
   *
   * @example
   *
   * ```ts
   * const machineSetup = setup({
   *   // ...
   * });
   *
   * const action = machineSetup.createAction(({ context, event }) => {
   *   console.log(context.count, event.value);
   * });
   *
   * const incrementAction = machineSetup.createAction(
   *   assign({ count: ({ context }) => context.count + 1 })
   * );
   *
   * const machine = machineSetup.createMachine({
   *   context: { count: 0 },
   *   entry: [action, incrementAction]
   * });
   * ```
   */
  createAction: ((
    action: ActionFunction<
      TContext,
      TEvent,
      TEvent,
      unknown,
      ToProvidedActor<TChildrenMap, TActors>,
      ToParameterizedObject<TActions>,
      ToParameterizedObject<TGuards>,
      TDelay,
      TEmitted
    >
  ) => typeof action) & {
    assign: <
      TParams extends ParameterizedObject['params'] | undefined,
      TActor extends ToProvidedActor<TChildrenMap, TActors>
    >(
      assignment:
        | Assigner<LowInfer<TContext>, TEvent, TParams, TEvent, TActor>
        | PropertyAssigner<LowInfer<TContext>, TEvent, TParams, TEvent, TActor>
    ) => ActionFunction<
      TContext,
      TEvent,
      TEvent,
      TParams,
      TActor,
      never,
      never,
      never,
      never
    >;
    sendTo: <
      TParams extends ParameterizedObject['params'] | undefined,
      TTargetActor extends AnyActorRef,
      TUsedDelay extends TDelay = never
    >(
      to:
        | TTargetActor
        | string
        | ((
            args: ActionArgs<TContext, TEvent, TEvent>,
            params: TParams
          ) => TTargetActor | string),
      eventOrExpr:
        | EventFrom<TTargetActor>
        | SendExpr<
            TContext,
            TEvent,
            TParams,
            InferEvent<Cast<EventFrom<TTargetActor>, EventObject>>,
            TEvent
          >,
      options?: SendToActionOptions<
        TContext,
        TEvent,
        TParams,
        TEvent,
        TUsedDelay
      >
    ) => ActionFunction<
      TContext,
      TEvent,
      TEvent,
      TParams,
      never,
      never,
      never,
      TDelay,
      never
    >;
    sendParent: <
      TParams extends ParameterizedObject['params'] | undefined,
      TSpecificEvent extends TEvent,
      TUsedDelay extends TDelay = never
    >(
      event:
        | TSpecificEvent
        | SendExpr<TContext, TEvent, TParams, TSpecificEvent, TEvent>,
      options?: SendToActionOptions<
        TContext,
        TEvent,
        TParams,
        TEvent,
        TUsedDelay
      >
    ) => ActionFunction<
      TContext,
      TEvent,
      TSpecificEvent,
      TParams,
      never,
      never,
      never,
      TDelay,
      never
    >;
    forwardTo: <TParams extends ParameterizedObject['params'] | undefined>(
      target:
        | string
        | AnyActorRef
        | ((
            args: ActionArgs<TContext, TEvent, TEvent>,
            params: TParams
          ) => string | AnyActorRef),
      options?: SendToActionOptions<TContext, TEvent, TParams, TEvent, any>
    ) => ActionFunction<
      TContext,
      TEvent,
      TEvent,
      TParams,
      never,
      never,
      never,
      TDelay,
      never
    >;
    raise: <
      TSpecificEvent extends TEvent,
      TParams extends ParameterizedObject['params'] | undefined,
      TUsedDelay extends TDelay = never
    >(
      eventOrExpr:
        | DoNotInfer<TSpecificEvent>
        | SendExpr<
            TContext,
            TEvent,
            TParams,
            DoNotInfer<TSpecificEvent>,
            TEvent
          >,
      options?: RaiseActionOptions<
        TContext,
        TEvent,
        TParams,
        DoNotInfer<TSpecificEvent>,
        TUsedDelay
      >
    ) => ActionFunction<
      TContext,
      TEvent,
      TSpecificEvent,
      TParams,
      never,
      never,
      never,
      TDelay,
      never
    >;
    log: <TParams extends ParameterizedObject['params'] | undefined>(
      value?: string | LogExpr<TContext, TEvent, TParams, TEvent>,
      label?: string
    ) => ActionFunction<
      TContext,
      TEvent,
      TEvent,
      TParams,
      never,
      never,
      never,
      never,
      never
    >;
    cancel: <TParams extends ParameterizedObject['params'] | undefined>(
      sendId:
        | string
        | ((
            args: ActionArgs<TContext, TEvent, TEvent>,
            params: TParams
          ) => string)
    ) => ActionFunction<
      TContext,
      TEvent,
      TEvent,
      TParams,
      never,
      never,
      never,
      never,
      never
    >;
    stopChild: <TParams extends ParameterizedObject['params'] | undefined>(
      actorRef:
        | string
        | AnyActorRef
        | ((
            args: ActionArgs<TContext, TEvent, TEvent>,
            params: TParams
          ) => AnyActorRef | string)
    ) => ActionFunction<
      TContext,
      TEvent,
      TEvent,
      TParams,
      never,
      never,
      never,
      never,
      never
    >;
  };
  createMachine: <
    const TConfig extends MachineConfig<
      TContext,
      TEvent,
      ToProvidedActor<TChildrenMap, TActors>,
      ToParameterizedObject<TActions>,
      ToParameterizedObject<TGuards>,
      TDelay,
      TTag,
      TInput,
      TOutput,
      TEmitted,
      TMeta
    >
  >(
    config: TConfig
  ) => StateMachine<
    TContext,
    TEvent,
    Cast<
      ToChildren<ToProvidedActor<TChildrenMap, TActors>>,
      Record<string, AnyActorRef | undefined>
    >,
    ToProvidedActor<TChildrenMap, TActors>,
    ToParameterizedObject<TActions>,
    ToParameterizedObject<TGuards>,
    TDelay,
    ToStateValue<TConfig>,
    TTag,
    TInput,
    TOutput,
    TEmitted,
    TMeta,
    TConfig
  >;
} {
  const createActionImpl = (
    fn: ActionFunction<
      TContext,
      TEvent,
      TEvent,
      unknown,
      ToProvidedActor<TChildrenMap, TActors>,
      ToParameterizedObject<TActions>,
      ToParameterizedObject<TGuards>,
      TDelay,
      TEmitted
    >
  ) => fn;

  const createActionWithStatics = Object.assign(createActionImpl, {
    assign,
    sendTo,
    sendParent,
    forwardTo,
    raise,
    log,
    cancel,
    stopChild
  });

  return {
    createStateConfig: (config) => config,
    createAction: createActionWithStatics as any,
    createMachine: (config) =>
      (createMachine as any)(
        { ...config, schemas },
        {
          actors,
          actions,
          guards,
          delays
        }
      )
  };
}
