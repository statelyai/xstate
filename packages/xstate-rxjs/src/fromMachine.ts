import { Observable } from 'rxjs';
import {
  AnyStateMachine,
  AreAllImplementationsAssumedToBeProvided,
  InternalMachineOptions,
  InterpreterFrom,
  InterpreterOptions,
  StateFrom
} from 'xstate';
import { fromInterpret } from './fromInterpret';
import { FromMachineOptions, MaybeLazy, Prop } from './types';

type RestParams<
  TMachine extends AnyStateMachine
> = AreAllImplementationsAssumedToBeProvided<
  TMachine['__TResolvedTypesMeta']
> extends false
  ? [
      options: InterpreterOptions &
        FromMachineOptions<TMachine['__TContext'], TMachine['__TEvent']> &
        InternalMachineOptions<
          TMachine['__TContext'],
          TMachine['__TEvent'],
          TMachine['__TResolvedTypesMeta'],
          true
        >
    ]
  : [
      options?: InterpreterOptions &
        FromMachineOptions<TMachine['__TContext'], TMachine['__TEvent']> &
        InternalMachineOptions<
          TMachine['__TContext'],
          TMachine['__TEvent'],
          TMachine['__TResolvedTypesMeta']
        >
    ];

interface FromMachineReturn<TMachine extends AnyStateMachine> {
  state$: Observable<StateFrom<TMachine>>;
  send: Prop<InterpreterFrom<TMachine>, 'send'>;
  service: InterpreterFrom<TMachine>;
}

export function fromMachine<TMachine extends AnyStateMachine>(
  getMachine: MaybeLazy<TMachine>,
  ...[options = {}]: RestParams<TMachine>
): FromMachineReturn<TMachine> {
  const { state$: _state$, send, service } = fromInterpret(getMachine, options);
  const state$ = new Observable<StateFrom<TMachine>>((subscriber) => {
    const subscription = _state$.subscribe(subscriber);

    return () => {
      service.stop();
      subscription.unsubscribe();
    };
  });

  return { state$, send, service };
}
