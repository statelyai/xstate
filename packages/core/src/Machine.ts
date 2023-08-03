import {
  MachineConfig,
  EventObject,
  MachineContext,
  InternalMachineImplementations,
  ParameterizedObject,
  ProvidedActor,
  AnyEventObject
} from './types.ts';
import {
  TypegenConstraint,
  TypegenDisabled,
  ResolveTypegenMeta
} from './typegenTypes.ts';
import { StateMachine } from './StateMachine.ts';
import { StateFrom, interpret } from './index.ts';

export interface StatesConfig {
  states?: {
    [key: string]: StatesConfig;
  };
}

export function createMachine<
  TContext extends MachineContext,
  TEvent extends EventObject = AnyEventObject,
  TActor extends ProvidedActor = ProvidedActor,
  TInput = any,
  TTypesMeta extends TypegenConstraint = TypegenDisabled,
  TConfig extends MachineConfig<
    TContext,
    TEvent,
    ParameterizedObject,
    TActor,
    TInput,
    TTypesMeta
  > = MachineConfig<
    TContext,
    TEvent,
    ParameterizedObject,
    TActor,
    TInput,
    TTypesMeta
  >
>(
  config: MachineConfig<
    TContext,
    TEvent,
    ParameterizedObject,
    TActor,
    TInput,
    TTypesMeta
  > &
    TConfig,
  implementations?: InternalMachineImplementations<
    TContext,
    TEvent,
    ParameterizedObject,
    TActor,
    ResolveTypegenMeta<TTypesMeta, TEvent, ParameterizedObject, TActor>
  >
): StateMachine<
  TContext,
  TEvent,
  ParameterizedObject,
  TActor,
  TInput,
  ResolveTypegenMeta<TTypesMeta, TEvent, ParameterizedObject, TActor>,
  TConfig
> {
  return new StateMachine<any, any, any, any, any, any>(
    config as any,
    implementations as any
  );
}

const trafficLight = createMachine({
  id: 'trafficLight',

  initial: 'green',
  states: {
    green: {
      on: {
        TIMER: 'yellow'
      }
    },
    yellow: {
      on: {
        TIMER: 'red'
      }
    },
    red: {
      initial: 'walk',
      states: {
        walk: {
          on: {
            PED_TIMER: 'wait'
          }
        },
        wait: {
          on: {
            PED_TIMER: 'stop'
          }
        },
        stop: {
          type: 'final'
        }
      }
    }
  }
});

trafficLight.getInitialState(null as any).matches('red');
trafficLight.getInitialState(null as any).matches({
  red: 'walk'
});
trafficLight.getInitialState(null as any).matches({
  red: 'wait'
});
trafficLight.getInitialState(null as any).matches({
  red: {
    wait: {}
  }
});

const actor = interpret(trafficLight).start();

actor.getSnapshot().matches('yellow');

type S = StateFrom<typeof trafficLight>['value'];
