import type {
  ActorLogic,
  ActorSystemRuntime,
  ExecutableActionObject
} from 'xstate';
import {
  createStoreTransition,
  TransitionsFromEventPayloadMap
} from './store.ts';
import {
  EnqueueObject,
  EventPayloadMap,
  StoreContext,
  Snapshot,
  StoreSnapshot,
  EventObject,
  ExtractEvents,
  InferSchemaPayloadMap,
  ResolveStoreContext,
  ResolveStoreEmittedPayloadMap,
  StoreSchemas,
  StandardSchemaMap
} from './types.ts';
import type { StandardSchemaV1 } from './schema.ts';

type StoreLogic<
  TContext extends StoreContext,
  TEvent extends EventObject,
  TInput,
  TEmitted extends EventObject
> = ActorLogic<StoreSnapshot<TContext>, TEvent, TInput, any, TEmitted>;

type FromStoreEmittedEvents<
  TEmittedPayloadMap extends EventPayloadMap,
  TEmittedSchemaMap extends StandardSchemaMap | undefined
> = ExtractEvents<
  ResolveStoreEmittedPayloadMap<TEmittedPayloadMap, TEmittedSchemaMap>
>;

type InferredFromStoreTransitions<
  TContext extends StoreContext,
  TTransitions extends Record<string, (...args: any[]) => any>,
  TEmittedPayloadMap extends EventPayloadMap,
  TContextSchema extends StandardSchemaV1 | undefined,
  TEmittedSchemaMap extends StandardSchemaMap | undefined
> = Record<
  string,
  (
    context: NoInfer<ResolveStoreContext<TContext, TContextSchema>>,
    event: any,
    enq: EnqueueObject<
      ResolveStoreContext<TContext, TContextSchema>,
      FromStoreEmittedEvents<TEmittedPayloadMap, TEmittedSchemaMap>,
      InferredEventPayloadMap<TTransitions>
    >
  ) => ResolveStoreContext<TContext, TContextSchema> | void
>;

type InferredEventPayloadMap<
  TTransitions extends Record<string, (...args: any[]) => any>
> = {
  [K in keyof TTransitions & string]: TTransitions[K] extends (
    context: any,
    event: infer TEvent,
    ...args: any[]
  ) => any
    ? Omit<TEvent, 'type'>
    : {};
};

type SchemaFromStoreTransitions<
  TContext extends StoreContext,
  TEventSchemaMap extends StandardSchemaMap,
  TEmittedPayloadMap extends EventPayloadMap,
  TContextSchema extends StandardSchemaV1 | undefined,
  TEmittedSchemaMap extends StandardSchemaMap | undefined
> = TransitionsFromEventPayloadMap<
  InferSchemaPayloadMap<TEventSchemaMap>,
  NoInfer<ResolveStoreContext<TContext, TContextSchema>>,
  FromStoreEmittedEvents<TEmittedPayloadMap, TEmittedSchemaMap>
>;

type FromStoreValueConfig<
  TContext extends StoreContext,
  TTransitions extends Record<string, (...args: any[]) => any>,
  TEmittedPayloadMap extends EventPayloadMap,
  TContextSchema extends StandardSchemaV1 | undefined,
  TEmittedSchemaMap extends StandardSchemaMap | undefined
> = {
  context: ResolveStoreContext<TContext, TContextSchema>;
  schemas?: StoreSchemas<TContextSchema, undefined, TEmittedSchemaMap>;
  on: TTransitions &
    InferredFromStoreTransitions<
      TContext,
      TTransitions,
      TEmittedPayloadMap,
      TContextSchema,
      TEmittedSchemaMap
    >;
};

type FromStoreInputConfig<
  TContext extends StoreContext,
  TTransitions extends Record<string, (...args: any[]) => any>,
  TInput,
  TEmittedPayloadMap extends EventPayloadMap,
  TContextSchema extends StandardSchemaV1 | undefined,
  TEmittedSchemaMap extends StandardSchemaMap | undefined
> = {
  context: (input: TInput) => ResolveStoreContext<TContext, TContextSchema>;
  schemas?: StoreSchemas<TContextSchema, undefined, TEmittedSchemaMap>;
  on: TTransitions &
    InferredFromStoreTransitions<
      TContext,
      TTransitions,
      TEmittedPayloadMap,
      TContextSchema,
      TEmittedSchemaMap
    >;
};

type SchemaFromStoreValueConfig<
  TContext extends StoreContext,
  TEventSchemaMap extends StandardSchemaMap,
  TEmittedPayloadMap extends EventPayloadMap,
  TContextSchema extends StandardSchemaV1 | undefined,
  TEmittedSchemaMap extends StandardSchemaMap | undefined
> = {
  context: ResolveStoreContext<TContext, TContextSchema>;
  schemas: StoreSchemas<TContextSchema, TEventSchemaMap, TEmittedSchemaMap> & {
    events: TEventSchemaMap;
  };
  on: SchemaFromStoreTransitions<
    TContext,
    TEventSchemaMap,
    TEmittedPayloadMap,
    TContextSchema,
    TEmittedSchemaMap
  >;
};

type SchemaFromStoreInputConfig<
  TContext extends StoreContext,
  TEventSchemaMap extends StandardSchemaMap,
  TInput,
  TEmittedPayloadMap extends EventPayloadMap,
  TContextSchema extends StandardSchemaV1 | undefined,
  TEmittedSchemaMap extends StandardSchemaMap | undefined
> = {
  context: (input: TInput) => ResolveStoreContext<TContext, TContextSchema>;
  schemas: StoreSchemas<TContextSchema, TEventSchemaMap, TEmittedSchemaMap> & {
    events: TEventSchemaMap;
  };
  on: SchemaFromStoreTransitions<
    TContext,
    TEventSchemaMap,
    TEmittedPayloadMap,
    TContextSchema,
    TEmittedSchemaMap
  >;
};

/**
 * An actor logic creator which creates store [actor
 * logic](https://stately.ai/docs/actors#actor-logic) for use with XState.
 *
 * @param config An object containing the store configuration
 * @param config.context The initial context for the store, either a function
 *   that returns context based on input, or the context itself
 * @param config.schemas Optional standard-schema definitions used as type
 *   sources for context, events, and emitted events
 * @param config.on An object defining the transitions for different event types
 * @returns An actor logic creator function that creates store actor logic
 */
export function fromStore<
  TContext extends StoreContext,
  const TTransitions extends Record<string, (...args: any[]) => any>,
  TInput,
  TEmittedPayloadMap extends EventPayloadMap = EventPayloadMap,
  TContextSchema extends StandardSchemaV1 | undefined = undefined,
  TEmittedSchemaMap extends StandardSchemaMap | undefined = undefined
>(
  config: FromStoreInputConfig<
    TContext,
    TTransitions,
    TInput,
    TEmittedPayloadMap,
    TContextSchema,
    TEmittedSchemaMap
  >
): StoreLogic<
  ResolveStoreContext<TContext, TContextSchema>,
  ExtractEvents<InferredEventPayloadMap<TTransitions>>,
  TInput,
  FromStoreEmittedEvents<TEmittedPayloadMap, TEmittedSchemaMap>
>;
export function fromStore<
  TContext extends StoreContext,
  const TTransitions extends Record<string, (...args: any[]) => any>,
  TEmittedPayloadMap extends EventPayloadMap = EventPayloadMap,
  TContextSchema extends StandardSchemaV1 | undefined = undefined,
  TEmittedSchemaMap extends StandardSchemaMap | undefined = undefined
>(
  config: FromStoreValueConfig<
    TContext,
    TTransitions,
    TEmittedPayloadMap,
    TContextSchema,
    TEmittedSchemaMap
  >
): StoreLogic<
  ResolveStoreContext<TContext, TContextSchema>,
  ExtractEvents<InferredEventPayloadMap<TTransitions>>,
  unknown,
  FromStoreEmittedEvents<TEmittedPayloadMap, TEmittedSchemaMap>
>;
export function fromStore<
  TContext extends StoreContext,
  TEventSchemaMap extends StandardSchemaMap,
  TInput,
  TEmittedPayloadMap extends EventPayloadMap = EventPayloadMap,
  TContextSchema extends StandardSchemaV1 | undefined = undefined,
  TEmittedSchemaMap extends StandardSchemaMap | undefined = undefined
>(
  config: SchemaFromStoreInputConfig<
    TContext,
    TEventSchemaMap,
    TInput,
    TEmittedPayloadMap,
    TContextSchema,
    TEmittedSchemaMap
  >
): StoreLogic<
  ResolveStoreContext<TContext, TContextSchema>,
  ExtractEvents<InferSchemaPayloadMap<TEventSchemaMap>>,
  TInput,
  FromStoreEmittedEvents<TEmittedPayloadMap, TEmittedSchemaMap>
>;
export function fromStore<
  TContext extends StoreContext,
  TEventSchemaMap extends StandardSchemaMap,
  TEmittedPayloadMap extends EventPayloadMap = EventPayloadMap,
  TContextSchema extends StandardSchemaV1 | undefined = undefined,
  TEmittedSchemaMap extends StandardSchemaMap | undefined = undefined
>(
  config: SchemaFromStoreValueConfig<
    TContext,
    TEventSchemaMap,
    TEmittedPayloadMap,
    TContextSchema,
    TEmittedSchemaMap
  >
): StoreLogic<
  ResolveStoreContext<TContext, TContextSchema>,
  ExtractEvents<InferSchemaPayloadMap<TEventSchemaMap>>,
  unknown,
  FromStoreEmittedEvents<TEmittedPayloadMap, TEmittedSchemaMap>
>;
export function fromStore(config: {
  context: ((input: unknown) => StoreContext) | StoreContext;
  schemas?: StoreSchemas<any, any, any>;
  on: TransitionsFromEventPayloadMap<any, any, any>;
}): StoreLogic<any, any, any, any> {
  const initialContext = config.context;
  const transition = createStoreTransition(config.on);
  const initialTransition: StoreLogic<
    any,
    any,
    any,
    any
  >['initialTransition'] = (input: unknown, _: unknown) => [
    {
      status: 'active',
      context:
        typeof initialContext === 'function'
          ? initialContext(input)
          : initialContext,
      output: undefined,
      error: undefined
    },
    []
  ];

  return {
    transition: (snapshot, event, actorScope) => {
      const [nextSnapshot, effects] = transition(snapshot, event);

      return [
        nextSnapshot,
        effects.map<ExecutableActionObject>((effect) => {
          if (typeof effect === 'function') {
            const action = (
              system: Partial<ActorSystemRuntime> = actorScope.self.system
            ) => {
              const send = (event: EventObject) =>
                void system.sendEvent!(actorScope.self, actorScope.self, event);
              return effect({
                send,
                trigger: new Proxy({} as any, {
                  get: (_, eventType: string) => {
                    return (payload: any) =>
                      send({ type: eventType, ...payload });
                  }
                }),
                getSnapshot: () => actorScope.self.getSnapshot()
              });
            };
            return {
              kind: 'action',
              type: 'effect',
              action,
              params: undefined,
              args: [],
              exec: action
            };
          }
          return {
            kind: 'emit',
            type: effect.type,
            source: actorScope.self,
            event: effect,
            params: undefined,
            args: [],
            exec: (
              system: Partial<ActorSystemRuntime> = actorScope.self.system
            ) => system.emitEvent!(actorScope.self, effect)
          };
        })
      ];
    },
    initialTransition,
    getInitialSnapshot: (actorScope, input: unknown) =>
      initialTransition(input, actorScope)[0],
    getPersistedSnapshot: (s: Snapshot<unknown>) => s,
    restoreSnapshot: (s: Snapshot<unknown>) => s as StoreSnapshot<any>
  };
}
