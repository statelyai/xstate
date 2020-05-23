import { useState, useEffect, useRef } from 'react';
import {
  interpret,
  EventObject,
  StateMachine,
  State,
  Interpreter,
  InterpreterOptions,
  MachineOptions,
  StateConfig,
  Typestate,
  ActionObject,
  ActionFunction,
  ActionMeta
} from 'xstate';
import useConstant from './useConstant';

export interface ReactActionFunction<TContext, TEvent extends EventObject> {
  (
    context: TContext,
    event: TEvent,
    meta: ActionMeta<TContext, TEvent>
  ): () => void;
  __effect: boolean;
}

export interface ReactActionObject<TContext, TEvent extends EventObject>
  extends ActionObject<TContext, TEvent> {
  exec: ReactActionFunction<TContext, TEvent>;
}

export function asEffect<TContext, TEvent extends EventObject>(
  exec: ActionFunction<TContext, TEvent>
): ReactActionFunction<TContext, TEvent> {
  const effectExec: unknown = (context, event, meta) => {
    // don't execute; just return
    return () => {
      return exec(context, event, meta);
    };
  };

  Object.defineProperties(effectExec, {
    name: { value: `effect:${exec.name}` },
    __effect: { value: true }
  });

  return effectExec as ReactActionFunction<TContext, TEvent>;
}

export type ActionStateTuple<TContext, TEvent extends EventObject> = [
  ReactActionObject<TContext, TEvent>,
  State<TContext, TEvent>
];

function executeEffect<TContext, TEvent extends EventObject>(
  action: ReactActionObject<TContext, TEvent>,
  state: State<TContext, TEvent>
): void {
  const { exec } = action;
  const originalExec = exec!(state.context, state._event.data, {
    action,
    state: state,
    _event: state._event
  });

  originalExec();
}

interface UseMachineOptions<TContext, TEvent extends EventObject> {
  /**
   * If provided, will be merged with machine's `context`.
   */
  context?: Partial<TContext>;
  /**
   * The state to rehydrate the machine to. The machine will
   * start at this state instead of its `initialState`.
   */
  state?: StateConfig<TContext, TEvent>;
}

export function useMachine<
  TContext,
  TEvent extends EventObject,
  TTypestate extends Typestate<TContext> = any
>(
  machine: StateMachine<TContext, any, TEvent, TTypestate>,
  options: Partial<InterpreterOptions> &
    Partial<UseMachineOptions<TContext, TEvent>> &
    Partial<MachineOptions<TContext, TEvent>> = {}
): [
  State<TContext, TEvent, any, TTypestate>,
  Interpreter<TContext, any, TEvent, TTypestate>['send'],
  Interpreter<TContext, any, TEvent, TTypestate>
] {
  if (process.env.NODE_ENV !== 'production') {
    const [initialMachine] = useState(machine);

    if (machine !== initialMachine) {
      console.warn(
        'Machine given to `useMachine` has changed between renders. This is not supported and might lead to unexpected results.\n' +
          'Please make sure that you pass the same Machine as argument each time.'
      );
    }
  }

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

  const service = useConstant(() => {
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

    return interpret(createdMachine, interpreterOptions).start(
      rehydratedState ? State.create(rehydratedState) : undefined
    );
  });

  const [state, setState] = useState(service.state);

  const effectActionsRef = useRef<
    Array<[ReactActionObject<TContext, TEvent>, State<TContext, TEvent>]>
  >([]);

  useEffect(() => {
    service.onTransition((currentState) => {
      if (currentState.changed) {
        setState(currentState);
      }

      if (currentState.actions.length) {
        const effectActions = currentState.actions.filter(
          (action): action is ReactActionObject<TContext, TEvent> => {
            return (
              typeof action.exec === 'function' &&
              (action as ReactActionObject<TContext, TEvent>).exec.__effect
            );
          }
        );

        effectActionsRef.current.push(
          ...effectActions.map<ActionStateTuple<TContext, TEvent>>(
            (effectAction) => [effectAction, currentState]
          )
        );
      }
    });

    // if service.state has not changed React should just bail out from this update
    setState(service.state);

    return () => {
      service.stop();
    };
  }, []);

  useEffect(() => {
    while (effectActionsRef.current.length) {
      const [effectAction, effectState] = effectActionsRef.current.shift()!;

      executeEffect(effectAction, effectState);
    }
  }, [state]);

  // Make sure actions and services are kept updated when they change.
  // This mutation assignment is safe because the service instance is only used
  // in one place -- this hook's caller.
  useEffect(() => {
    Object.assign(service.machine.options.actions, actions);
  }, [actions]);

  useEffect(() => {
    Object.assign(service.machine.options.services, services);
  }, [services]);

  return [state, service.send, service];
}
