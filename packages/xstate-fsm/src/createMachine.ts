import { EventObject } from '.';

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

type TransitionConfig2<_Self, TMachine extends MachineConfig2<any>> =
  | keyof A.Get<TMachine, 'states'>
  | {
      target?: keyof A.Get<TMachine, 'states'>;
    };

interface StateNodeConfig2<_Self, TMachine extends MachineConfig2<any>> {
  invoke?: {
    id: string;
    src: () => Behavior;
  };
  on?: {
    [key in keyof A.Get<_Self, 'on'>]: TransitionConfig2<
      A.Get<_Self, ['on', key]>,
      TMachine
    >;
  };
}

interface MachineConfig2<Self> {
  id?: string;
  key?: string;
  context?: A.Get<Self, 'context'>;
  // on?: Transitions2<A.Get<Self, 'on'>, Self, undefined, Self, TSchema>;
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
  context?: any;
  actions: any[];
}

interface Machine<T extends MachineConfig2<any>> {
  transition: (state: StateFrom<T>, event: EventObject) => StateFrom<T>;
  initialState: StateFrom<T>;
}

export function createMachine2<T extends MachineConfig2<T>>(
  config: InferNarrowestObject<T>
): Machine<T> {
  const machine: Machine<T> = {
    transition: (state, event) => {
      const stateConfig =
        config.states?.[state.value as keyof A.Get<T, 'states'>];

      if (stateConfig?.on) {
        const transitions = [stateConfig.on[event.type]]; // TODO: array

        for (const transition of transitions) {
          const transitionObject =
            typeof transition === 'string'
              ? { target: transition }
              : transition;
          if (transitionObject === undefined) {
            return state;
          }

          const { target } = transitionObject;

          const nextStateConfig = config.states?.[target];

          const actions: any[] = [];
          if (nextStateConfig?.invoke) {
            actions.push({
              type: 'xstate.start',
              invoke: nextStateConfig.invoke
            });
          }

          return {
            value: target,
            actions
          };
        }
      }

      return state;
    },
    initialState: {
      value: config.initial ?? null,
      actions: []
    }
  };

  return machine;
}

export function interpret(machine: any) {
  let state = machine.initialState;
  const observers = new Set<any>();
  // let status = 0;

  const self = {
    send: (event: any) => {
      console.log(event);
      state = machine.transition(state, event);
      console.log(state.actions);

      state.actions.forEach((action) => {
        if (action.type === 'xstate.start') {
          const actorRef = action.invoke.src().start();

          actorRef.subscribe({
            next: (data) => {
              self.send({
                type: `done.invoke.${action.invoke.id}`,
                data
              });
            }
          });
        }
      });

      observers.forEach((obs) => obs.next(state));
    },
    subscribe: (obs) => {
      if (typeof obs === 'function') {
        observers.add({ next: obs });
      } else {
        observers.add(obs);
      }
    }
  };

  return self;
}

createMachine2({
  states: {
    red: {},
    green: {
      on: {
        EVENT: 'yellow'
      }
    },
    yellow: {}
  },
  initial: 'green',
  on: {
    EVENT: {
      target: '.red'
    }
  }
});
