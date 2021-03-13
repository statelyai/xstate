import {
  interpret,
  EventObject,
  StateMachine,
  Interpreter,
  InterpreterOptions,
  MachineOptions,
  Typestate
} from 'xstate';
import { UseMachineOptions } from './types';

export function useInterpret<
  TContext,
  TEvent extends EventObject,
  TTypestate extends Typestate<TContext> = { value: any; context: TContext }
>(
  machine: StateMachine<TContext, any, TEvent, TTypestate>,
  options: Partial<InterpreterOptions> &
    Partial<UseMachineOptions<TContext, TEvent>> &
    Partial<MachineOptions<TContext, TEvent>> = {}
): Interpreter<TContext, any, TEvent, TTypestate> {
  const {
    context,
    guards,
    actions,
    activities,
    services,
    delays,
    state: rehydratedState,
    ...interpreterOptions
  } = options;

  const machineConfig = {
    context,
    guards,
    actions,
    activities,
    services,
    delays
  };

  const createdMachine = machine.withConfig(machineConfig, {
    ...machine.context,
    ...context
  } as TContext);

  const service = interpret(createdMachine, {
    deferEvents: true,
    ...interpreterOptions
  });

  return service;
}
