import { ReactiveController, ReactiveControllerHost } from 'lit';
import {
  EventObject,
  Typestate,
  StateMachine,
  InterpreterOptions,
  MachineOptions,
  interpret,
  State,
  Interpreter
} from 'xstate';
import { MaybeLazy, RehydrateOptions } from './types';

export class ServiceController<
  TContext,
  TEvent extends EventObject,
  TTypestate extends Typestate<TContext> = { value: any; context: TContext }
> implements ReactiveController {
  private host: ReactiveControllerHost;
  readonly service: Interpreter<TContext, any, TEvent, TTypestate>;

  constructor(
    host: ReactiveControllerHost,
    getMachine: MaybeLazy<StateMachine<TContext, any, TEvent, TTypestate>>,
    options: Partial<InterpreterOptions> &
      RehydrateOptions<TContext, TEvent> = {}
  ) {
    this.host = host;
    this.host.addController(this);
    const machine =
      typeof getMachine === 'function' ? getMachine() : getMachine;
    const { state: rehydratedState, ...interpreterOptions } = options;

    this.service = interpret(machine, interpreterOptions).start(
      rehydratedState ? (State.create(rehydratedState) as any) : undefined
    );
  }

  hostDisconnected() {
    this.service.stop();
  }
}

export function connectService<
  TContext,
  TEvent extends EventObject,
  TTypestate extends Typestate<TContext> = { value: any; context: TContext }
>(
  host: ReactiveControllerHost,
  getMachine: MaybeLazy<StateMachine<TContext, any, TEvent, TTypestate>>,
  options: Partial<InterpreterOptions> &
    Partial<MachineOptions<TContext, TEvent>> = {}
) {
  return new ServiceController(host, getMachine, options);
}
