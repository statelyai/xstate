import {
  MachineConfig,
  EventObject,
  AnyEventObject,
  MachineContext,
  ActorMap,
  InternalMachineImplementations,
  ParameterizedObject
} from './types.ts';
import {
  TypegenConstraint,
  TypegenDisabled,
  ResolveTypegenMeta
} from './typegenTypes.ts';
import { StateMachine } from './StateMachine.ts';

export function createMachine<
  TContext extends MachineContext,
  TEvent extends EventObject = AnyEventObject,
  TActorMap extends ActorMap = ActorMap,
  TTypesMeta extends TypegenConstraint = TypegenDisabled,
  TConfig extends MachineConfig<any, any, any, any, any> = MachineConfig<
    TContext,
    TEvent,
    ParameterizedObject,
    TActorMap,
    TTypesMeta
  >
>(
  config: MachineConfig<
    TContext,
    TEvent,
    ParameterizedObject,
    TActorMap,
    TTypesMeta
  > &
    TConfig,
  implementations?: InternalMachineImplementations<
    TContext,
    TEvent,
    ResolveTypegenMeta<TTypesMeta, TEvent, ParameterizedObject, TActorMap>
  >
): StateMachine<
  TContext,
  TEvent,
  ParameterizedObject,
  TActorMap,
  ResolveTypegenMeta<TTypesMeta, TEvent, ParameterizedObject, TActorMap>,
  TConfig
> {
  return new StateMachine<any, any, any, any, any>(
    config,
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

trafficLight.initialState.matches('green');
trafficLight.initialState.matches('red');
trafficLight.initialState.matches({
  red: 'wait'
});
trafficLight.initialState.matches({
  red: {
    wait: {}
  }
});
