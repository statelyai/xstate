import type {
  StateMachine,
  InterpreterOptions,
  AreAllImplementationsAssumedToBeProvided,
  InternalMachineOptions,
  InterpreterFrom,
  StateFrom,
  TypegenEnabled
} from 'xstate';
import { State } from 'xstate';
import { createStore } from 'solid-js/store';
import type { MaybeLazy, UseMachineOptions, Prop } from './types';
import { useInterpret } from './useInterpret';
import { batch } from 'solid-js';
import { updateState } from './utils';

type RestParams<
  TMachine extends StateMachine<any, any, any, any, any, any, any>
> = AreAllImplementationsAssumedToBeProvided<
  TMachine['__TResolvedTypesMeta']
> extends false
  ? [
      options: InterpreterOptions &
        UseMachineOptions<TMachine['__TContext'], TMachine['__TEvent']> &
        InternalMachineOptions<
          TMachine['__TContext'],
          TMachine['__TEvent'],
          TMachine['__TResolvedTypesMeta'],
          true
        >
    ]
  : [
      options?: InterpreterOptions &
        UseMachineOptions<TMachine['__TContext'], TMachine['__TEvent']> &
        InternalMachineOptions<
          TMachine['__TContext'],
          TMachine['__TEvent'],
          TMachine['__TResolvedTypesMeta']
        >
    ];

type UseMachineReturn<
  TMachine extends StateMachine<any, any, any, any, any, any, any>,
  TInterpreter = InterpreterFrom<TMachine>
> = [StateFrom<TMachine>, Prop<TInterpreter, 'send'>, TInterpreter];

export function useMachine<
  TMachine extends StateMachine<any, any, any, any, any, any, any>
>(
  getMachine: MaybeLazy<TMachine>,
  ...[options = {}]: RestParams<TMachine>
): UseMachineReturn<TMachine> {
  const service = useInterpret(getMachine, options);

  // Get initial state - ensures that the service initialState is tracked
  let initialState = {} as StateFrom<TMachine>;
  if (service.machine.initialState && !options.state) {
    initialState = service.machine.initialState as StateFrom<TMachine>;
  } else if (options.state) {
    initialState = (State.create(
      options.state
    ) as unknown) as StateFrom<TMachine>;
  }

  const [state, setState] = createStore({
    ...initialState,
    event: initialState.event || null,
    can: initialState.can,
    toStrings: initialState.toStrings,
    hasTag: initialState.hasTag,
    toJSON: initialState.toJSON,
    matches<
      TSV extends TMachine['__TResolvedTypesMeta'] extends TypegenEnabled
        ? Prop<TMachine['__TResolvedTypesMeta'], 'matchesStates'>
        : TMachine['__TTypestate']['value']
    >(parentStateValue: TSV) {
      // tslint:disable-next-line:no-unused-expression
      state.value; // sets state.value to be tracked by the store
      return service.state.matches(parentStateValue);
    }
  } as StateFrom<TMachine>);

  service.onTransition((nextState) => {
    batch(() => {
      updateState(nextState, setState);
    });
  });

  return [
    // States are readonly by default, make downstream typing easier by casting away from DeepReadonly wrapper
    (state as unknown) as StateFrom<TMachine>,
    service.send,
    service
  ] as UseMachineReturn<TMachine>;
}
