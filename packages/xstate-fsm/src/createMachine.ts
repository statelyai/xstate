import { EventObject, toActionObject } from '.';
import { SingleOrArray } from './types';

export namespace A {
  export type Cast<T, U> = T extends U ? T : U;
  export type Fallback<T, U> = T extends U ? T : U;
  export type Tuple<T = any> = T[] | [T];
  export type Object = object;
  export type String = string;
  export type Function = (...args: any[]) => any;
  export namespace Get {
    const Returned$$ = Symbol('Returned$$');
    export type Returned$$ = typeof Returned$$;
    const Parameters$$ = Symbol('Parameters$$');
    export type Parameters$$ = typeof Parameters$$;
  }
  type _Get<T, P, F> = P extends []
    ? T extends undefined
      ? F
      : T
    : P extends [infer K1, ...infer Kr]
    ? K1 extends keyof T
      ? _Get<T[K1], Kr, F>
      : K1 extends Get.Returned$$
      ? _Get<T extends (...a: any[]) => infer R ? R : undefined, Kr, F>
      : K1 extends Get.Parameters$$
      ? _Get<T extends (...a: infer A) => any ? A : undefined, Kr, F>
      : F
    : never;
  export type Get<T, TProps, TDefault = undefined> = TProps extends any[]
    ? _Get<T, TProps, TDefault>
    : _Get<T, [TProps], TDefault>;
}

export type InferNarrowest<T> = T extends any
  ? T extends A.Function
    ? T
    : T extends A.Object
    ? InferNarrowestObject<T>
    : T
  : never;

export type InferNarrowestObject<T> = {
  readonly [K in keyof T]: InferNarrowest<T[K]>;
};

interface ActorRef<TEvent extends EventObject> {
  send: (event: TEvent) => void;
  subscribe: (observer: any) => void;
}

interface Behavior {
  start: () => ActorRef<any>;
}
export function assign<TMachine extends MachineConfig2<any>>(
  assignment: Assigner<TMachine> | PropertyAssigner<TMachine>
): DynamicActionObject<TMachine> {
  const d = function resolveAssign(ctx, eventObject) {
    if (typeof assignment === 'function') {
      return assignment(ctx, eventObject);
    }
    const tmpContext = { ...ctx };
    for (const key in assignment) {
      const assigner = assignment[key];
      tmpContext[key] =
        typeof assigner === 'function' ? assigner(ctx, eventObject) : assigner;
    }

    return tmpContext;
  };

  // @ts-ignore
  d.type = 'xstate.assign' as const;
  d.__xstate = true as true;
  return d;
}
export interface AssignActionObject<TMachine> {
  __xstate?: true;
  type: 'xstate.assign';
  assignment: Assigner<TMachine> | PropertyAssigner<TMachine>;
}
export type Assigner<TMachine> = (
  context: A.Get<TMachine, 'context'>,
  event: A.Get<TMachine, ['schema', 'event']>
) => Partial<A.Get<TMachine, 'context'>>;

export type PropertyAssigner<TMachine> = {
  [K in keyof A.Get<TMachine, 'context'>]?:
    | ((
        context: A.Get<TMachine, 'context'>,
        event: A.Get<TMachine, ['schema', 'event']>
      ) => A.Get<TMachine, ['context', K]>)
    | A.Get<TMachine, ['context', K]>;
};

type ActionsConfig2<TMachine> = SingleOrArray<
  | DynamicActionObject<TMachine>
  | ((ctx: A.Get<TMachine, 'context'>) => void)
  | { type: string }
  | string
>;

type TransitionConfig2<_Self, TMachine> =
  | (string & keyof A.Get<TMachine, 'states'>)
  | {
      target?: string & keyof A.Get<TMachine, 'states'>;
      guard?: (
        context: A.Get<TMachine, 'context'>,
        event: A.Get<TMachine, ['schema', 'event']>
      ) => boolean;
      actions?: ActionsConfig2<TMachine>;
    };

interface StateNodeConfig2<_Self, TMachine extends MachineConfig2<any>> {
  entry?: ActionsConfig2<TMachine>;
  exit?: ActionsConfig2<TMachine>;
  invoke?: {
    id: string;
    src: Behavior | (() => Behavior);
  };
  on?: {
    [EventType in string &
      A.Get<TMachine, ['schema', 'event', 'type'], string>]?:
      | TransitionConfig2<A.Get<_Self, ['on', EventType]>, TMachine>
      | {
          [n in number]: TransitionConfig2<
            A.Get<_Self, ['on', EventType, n]>,
            TMachine
          >;
        };
  };
}

interface TransitionObject2 {
  target?: string;
  guard?: (context: any, eventObject: any) => boolean;
  actions?: Array<{ type: string }>;
}

interface StateNode2 {
  entry?: Array<{ type: string }>;
  exit?: Array<{ type: string }>;
  invoke?: {
    id: string;
    src: Behavior | (() => Behavior);
  };
  on?: {
    [EventType in string]: TransitionObject2[];
  };
}

export type NoInfer<T> = [T][T extends any ? 0 : any];

interface MachineConfig2<
  Self extends MachineConfig2<any>,
  TContext = A.Get<Self, 'context'>
> {
  id?: string;
  key?: string;
  context: TContext;
  schema?: {
    event?: EventObject;
  };
  states?: {
    [StateKey in keyof A.Get<Self, 'states'>]?: StateNodeConfig2<
      A.Get<Self, ['states', StateKey]>,
      Self
    >;
  };
  on?: {
    [key: string]: {
      target: `.${string & keyof A.Get<Self, 'states'>}`;
    };
  };
  initial?: keyof A.Get<Self, 'states'>;
}

interface StateFrom<T extends MachineConfig2<any>> {
  value: keyof A.Get<T, 'states'> | null;
  context: A.Get<T, 'context'>;
  actions: any[];
  matches: (value: keyof A.Get<T, 'states'>) => boolean;
}

interface Machine<T extends MachineConfig2<any>> {
  states: {
    [StateKey: string]: StateNode2;
  };
  transition: (
    state: StateFrom<T>,
    event: EventObject & A.Get<T, ['schema', 'event'], EventObject>,
    execute?: (action: any, state: any) => void
  ) => StateFrom<T>;
  initialState: StateFrom<T>;
  getInitialState: (exec: any) => StateFrom<T>;
}

function toArray<T>(item: T | T[] | undefined): T[] {
  return item === undefined ? [] : ([] as T[]).concat(item);
}

export function createMachine2<T extends MachineConfig2<T>>(
  config: InferNarrowestObject<T>
): Machine<T> {
  const states: Record<string, StateNode2> = {};

  if (config.states) {
    Object.entries(
      config.states as Record<string, StateNodeConfig2<any, any>>
    ).forEach(([key, stateConfig]) => {
      const transitionMap: Record<string, TransitionObject2[]> = {};

      if (stateConfig.on) {
        Object.entries(
          stateConfig.on as Record<
            string,
            SingleOrArray<TransitionConfig2<any, any>>
          >
        ).map(([eventType, transitionConfig]) => {
          const transitions = toArray(transitionConfig);
          transitionMap[eventType] = transitions.map((t) =>
            typeof t === 'string'
              ? { target: t }
              : {
                  target: t.target,
                  actions: t.actions
                    ? toArray(t.actions).map((action) =>
                        toActionObject(action, {})
                      )
                    : undefined,
                  guard: t.guard
                }
          );
        });
      }
      states[key] = {
        entry: stateConfig.entry
          ? toArray(stateConfig.entry).map((action) =>
              toActionObject(action, {})
            )
          : undefined,
        exit: stateConfig.exit
          ? toArray(stateConfig.exit).map((action) =>
              toActionObject(action, {})
            )
          : undefined,
        invoke: stateConfig.invoke,
        on: transitionMap
      };
    });
  }

  const machine: Machine<T> = {
    states,
    transition: (state, eventObject, execute) => {
      if (state.value === null) {
        return state;
      }

      const stateNodeObject = machine.states[state.value as string];

      if (!stateNodeObject) {
        throw new Error(`Invalid state value: ${state.value}`);
      }

      if (stateNodeObject?.on) {
        const transitions = toArray(stateNodeObject.on[eventObject.type] ?? []);

        for (const transitionObject of transitions) {
          const { target = state.value as string, guard } = transitionObject;

          if (guard && !guard(state.context, eventObject)) {
            continue;
          }

          const nextStateNodeObject = target
            ? machine.states?.[target]
            : undefined;

          if (target && !nextStateNodeObject) {
            throw new Error(`Invalid next state value: ${target}`);
          }

          const actions: any[] = [];
          if (nextStateNodeObject?.invoke) {
            actions.push({
              type: 'xstate.start',
              invoke: nextStateNodeObject.invoke
            });
          }

          if (target !== state.value) {
            actions.push(
              ...(stateNodeObject.exit ?? []),
              ...(transitionObject.actions ?? []),
              ...(nextStateNodeObject!.entry ?? [])
            );
          } else {
            actions.push(...(transitionObject.actions ?? []));
          }

          let nextContext = state.context;

          for (const action of actions) {
            if (action.type === 'xstate.assign') {
              nextContext = action(nextContext, eventObject);
            } else {
              execute?.(action, nextContext);
            }
          }

          return {
            value: target,
            actions,
            context: nextContext,
            matches: (value) => value === target
          } as StateFrom<T>;
        }
      }

      // INITIAL STATE
      if (eventObject.type === 'xstate.init') {
        let nextContext = state.context;

        for (const action of state.actions) {
          if (action.type === 'xstate.assign') {
            nextContext = action(nextContext, eventObject);
          } else {
            execute?.(action, nextContext);
          }
        }

        return {
          ...state,
          context: nextContext
        };
      }

      return state;
    },
    get initialState() {
      return machine.transition(
        {
          value: config.initial ?? null,
          actions: config.initial
            ? states[config.initial as string].entry ?? []
            : [],
          context: config.context as any,
          matches: () => true
        },
        { type: 'xstate.init' } as any
      );
    },
    getInitialState: (exec) => {
      return machine.transition(
        {
          value: config.initial ?? null,
          actions: config.initial
            ? states[config.initial as string].entry ?? []
            : [],
          context: config.context as any,
          matches: () => true
        },
        { type: 'xstate.init' } as any,
        exec
      );
    }
  };

  return machine;
}

interface Interpreter2 {
  start: () => Interpreter2;
  send: (event: EventObject) => void;
  subscribe: (obs: any) => { unsubscribe: () => void };
  getSnapshot: () => StateFrom<any>;
}

export function interpret(machine: Machine<any>): Interpreter2 {
  // let state: StateFrom<typeof machine>;
  let state: StateFrom<any>;
  const observers = new Set<any>();
  let status = 0;

  const executor = (action) => {
    if ('exec' in action) {
      action.exec();
    }
  };

  const self: Interpreter2 = {
    start: () => {
      status = 1;
      state = machine.getInitialState(executor);
      observers.forEach((obs) => obs.next(state));
      return self;
    },
    send: (event: any) => {
      if (status !== 1) {
        return;
      }

      state = machine.transition(state, event, executor);

      state.actions.forEach((action) => {
        if (action.type === 'xstate.start') {
          const { src } = action.invoke;

          const srcBehavior = typeof src === 'function' ? src() : src;
          const actorRef = srcBehavior.start();

          actorRef.subscribe({
            next: (data) => {
              self.send({
                type: `done.invoke.${action.invoke.id}`,
                data
              } as any);
            }
          });
        }
      });

      observers.forEach((obs) => obs.next(state));
    },
    subscribe: (obs) => {
      let observer = obs;
      if (typeof obs === 'function') {
        observer = { next: obs };
      }
      observers.add(observer);

      observer.next(state);

      return {
        unsubscribe: () => {
          observers.delete(observer);
        }
      };
    },
    getSnapshot: () => state
  };

  return self;
}

interface DynamicActionObject<TMachine> {
  type: `xstate.${string}`;
  (
    ctx: A.Get<TMachine, 'context'>,
    eventObject: A.Get<TMachine, ['schema', 'event']>
  ): { type: string };
  __xstate: true;
}

createMachine2({
  context: {
    num: 42
  },
  schema: {
    event: {} as { type: 'EVENT' } | { type: 'WHATEVER' }
  },
  states: {
    red: {},
    green: {
      on: {
        EVENT: 'yellow'
      }
    },
    yellow: {
      entry: assign((ctx) => ({ num: ctx.num + 3 })),
      on: {
        WHATEVER: [
          {
            guard: (ctx) => ctx.num === 42,
            target: 'green'
          }
        ]
      }
    }
  },
  initial: 'green',
  on: {
    EVENT: {
      target: '.red'
    }
  }
});

createMachine2({
  initial: 'inactive',
  context: { num: 42 },
  states: {
    inactive: {
      entry: assign({ num: 2 }),
      on: {
        EVENT: [
          {
            guard: (ctx) => ctx.num === 20,
            target: 'inactive'
          },
          'active'
        ],
        FOO: {
          guard: (_ctx) => true
        }
      }
    },
    active: {},
    fail: {}
  }
});

createMachine2({
  id: 'light',
  initial: 'green',
  context: { count: 0, foo: 'bar', go: true },
  states: {
    green: {
      entry: 'enterGreen',
      exit: [
        'exitGreen',
        assign({ count: (ctx) => ctx.count + 1 }),
        assign({ count: (ctx) => ctx.count + 1 }),
        assign({ foo: 'static' }),
        assign({ foo: (ctx) => ctx.foo + '++' })
      ],
      on: {
        TIMER: {
          target: 'yellow',
          actions: ['g-y 1', 'g-y 2']
        }
      }
    },
    yellow: {
      entry: assign({ go: false })
    },
    red: {}
  }
});

export function createPromiseBehavior<T>(
  createPromise: () => Promise<T>
): Behavior {
  return {
    start: () => {
      const observers = new Set<any>();

      createPromise().then((res) => observers.forEach((o) => o.next(res)));

      return {
        send: () => void 0,
        subscribe: (obs) => {
          observers.add(obs);

          return {
            unsubscribe: () => {
              observers.delete(obs);
            }
          };
        }
      };
    }
  };
}
