import {
  StateMachine,
  MachineOptions,
  DefaultContext,
  MachineConfig,
  StateSchema,
  EventObject,
  AnyEventObject,
  Typestate,
  ActionObject
} from './types';
import { StateNode } from './StateNode';

export function Machine<
  TContext = any,
  TEvent extends EventObject = AnyEventObject
>(
  config: MachineConfig<TContext, any, TEvent, ActionObject<TContext, TEvent>>,
  options?: Partial<MachineOptions<TContext, TEvent>>,
  initialContext?: TContext
): StateMachine<TContext, any, TEvent>;
export function Machine<
  TContext = DefaultContext,
  TStateSchema extends StateSchema = any,
  TEvent extends EventObject = AnyEventObject
>(
  config: MachineConfig<
    TContext,
    TStateSchema,
    TEvent,
    ActionObject<TContext, TEvent>
  >,
  options?: Partial<MachineOptions<TContext, TEvent>>,
  initialContext?: TContext
): StateMachine<TContext, TStateSchema, TEvent>;
export function Machine<
  TContext = DefaultContext,
  TStateSchema extends StateSchema = any,
  TEvent extends EventObject = AnyEventObject
>(
  config: MachineConfig<
    TContext,
    TStateSchema,
    TEvent,
    ActionObject<TContext, TEvent>
  >,
  options?: Partial<MachineOptions<TContext, TEvent>>,
  initialContext: TContext | (() => TContext) | undefined = config.context
): StateMachine<TContext, TStateSchema, TEvent> {
  const resolvedInitialContext =
    typeof initialContext === 'function'
      ? (initialContext as () => TContext)()
      : initialContext;

  return new StateNode<TContext, TStateSchema, TEvent>(
    config,
    options,
    resolvedInitialContext
  ) as StateMachine<TContext, TStateSchema, TEvent>;
}

export function createMachine<
  TContext,
  TEvent extends EventObject = AnyEventObject,
  TTypestate extends Typestate<TContext> = { value: any; context: TContext },
  TActions extends ActionObject<TContext, TEvent> = ActionObject<
    TContext,
    TEvent
  >
>(
  config: MachineConfig<TContext, any, TEvent, TActions>,
  options?: Partial<MachineOptions<TContext, TEvent>>
): StateMachine<TContext, any, TEvent, TTypestate> {
  const resolvedInitialContext =
    typeof config.context === 'function'
      ? (config.context as () => TContext)()
      : config.context;

  return new StateNode<TContext, any, TEvent, TTypestate>(
    config,
    options,
    resolvedInitialContext
  ) as StateMachine<TContext, any, TEvent, TTypestate>;
}
