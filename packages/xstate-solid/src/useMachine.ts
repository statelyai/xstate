import type {
  EventObject,
  StateMachine,
  InterpreterOptions,
  MachineOptions,
  Typestate,
  Interpreter
} from 'xstate';
import { State } from 'xstate';
import { createStore } from 'solid-js/store';
import type { MaybeLazy, UseMachineOptions } from './types';
import { useInterpret } from './useInterpret';
import { batch } from 'solid-js';
import { updateState } from './utils';

export function useMachine<
  TContext,
  TEvent extends EventObject,
  TTypestate extends Typestate<TContext>
>(
  getMachine: MaybeLazy<StateMachine<TContext, any, TEvent, TTypestate>>,
  options: Partial<InterpreterOptions> &
    Partial<UseMachineOptions<TContext, TEvent>> &
    Partial<MachineOptions<TContext, TEvent>> = {}
): [
  State<TContext, TEvent, any, TTypestate>,
  Interpreter<TContext, any, TEvent, TTypestate>['send'],
  Interpreter<TContext, any, TEvent, TTypestate>
] {
  const service = useInterpret(getMachine, options);

  // Get initial state - ensures that the service initialState is tracked
  let initialState = {} as State<TContext, TEvent, any, TTypestate>;
  if (service.machine.initialState && !options.state) {
    initialState = service.machine.initialState;
  } else if (options.state) {
    initialState = (State.create(options.state) as unknown) as State<
      TContext,
      TEvent,
      any,
      TTypestate
    >;
  }

  const [state, setState] = createStore({
    ...initialState,
    event: initialState.event || null,
    can: initialState.can,
    toStrings: initialState.toStrings,
    hasTag: initialState.hasTag,
    toJSON: initialState.toJSON,
    matches<TSV extends TTypestate['value']>(parentStateValue: TSV) {
      // tslint:disable-next-line:no-unused-expression
      state.value; // sets state.value to be tracked by the store
      return service.state.matches(parentStateValue);
    }
  } as State<TContext, TEvent, any, TTypestate>);

  service.onTransition((nextState) => {
    batch(() => {
      updateState(nextState, setState);
    });
  });

  return [
    // States are readonly by default, make downstream typing easier by casting away from DeepReadonly wrapper
    (state as unknown) as State<TContext, TEvent, any, TTypestate>,
    service.send,
    service
  ];
}
