import { from, Observable } from 'rxjs';
import { distinctUntilChanged, shareReplay } from 'rxjs/operators';
import {
  AnyStateMachine,
  AreAllImplementationsAssumedToBeProvided,
  InternalMachineOptions,
  interpret,
  InterpreterFrom,
  InterpreterOptions,
  InterpreterStatus,
  State,
  StateFrom
} from 'xstate';
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

type FromInterpretReturn<
  TMachine extends AnyStateMachine,
  TInterpreter = InterpreterFrom<TMachine>
> = {
  state$: Observable<StateFrom<TMachine>>;
  send: Prop<TInterpreter, 'send'>;
  service: TInterpreter;
};

export function fromInterpret<TMachine extends AnyStateMachine>(
  getMachine: MaybeLazy<TMachine>,
  ...[options = {}]: RestParams<TMachine>
): FromInterpretReturn<TMachine> {
  const machine = typeof getMachine === 'function' ? getMachine() : getMachine;

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

  const machineWithConfig = machine.withConfig(machineConfig as any, () => ({
    ...machine.context,
    ...context
  }));

  const service = interpret(machineWithConfig, interpreterOptions);
  const state$ = fromService(service);

  service.start(
    rehydratedState ? (State.create(rehydratedState) as any) : undefined
  );

  return { state$, send: service.send, service } as any;
}

function fromService<TMachine extends AnyStateMachine>(
  interpreter: InterpreterFrom<TMachine>
): Observable<StateFrom<TMachine>> {
  return (from(interpreter) as Observable<StateFrom<TMachine>>).pipe(
    distinctUntilChanged((prevState, nextState) => {
      if (interpreter.status === InterpreterStatus.NotStarted) {
        return true;
      }

      // Only change the current state if:
      // - the incoming state is the "live" initial state (since it might have new actors)
      // - OR the incoming state actually changed.
      //
      // The "live" initial state will have .changed === undefined.
      const initialStateChanged =
        nextState.changed === undefined &&
        (Object.keys(nextState.children).length > 0 ||
          typeof prevState.changed === 'boolean');

      return !(nextState.changed || initialStateChanged);
    }),
    shareReplay(1)
  );
}
