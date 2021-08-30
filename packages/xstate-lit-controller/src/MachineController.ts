import { ReactiveController, ReactiveControllerHost } from 'lit';
import {
  EventObject,
  InterpreterOptions,
  MachineOptions,
  StateMachine,
  Typestate
} from 'xstate';
import { connectService, ServiceController } from './ServiceController';
import { MaybeLazy, RehydrateOptions } from './types';

export class MachineController<
  TContext,
  TEvent extends EventObject,
  TTypestate extends Typestate<TContext> = { value: any; context: TContext }
> implements ReactiveController {
  private host: ReactiveControllerHost;
  private serviceController: ServiceController<TContext, TEvent, TTypestate>;

  constructor(
    host: ReactiveControllerHost,
    getMachine: MaybeLazy<StateMachine<TContext, any, TEvent, TTypestate>>,
    options: Partial<InterpreterOptions> &
      RehydrateOptions<TContext, TEvent> = {}
  ) {
    this.host = host;
    this.host.addController(this);
    this.serviceController = connectService(host, getMachine, options);
  }

  get service() {
    return this.serviceController.service;
  }

  get state() {
    return this.service.state;
  }

  get send() {
    return this.service.send;
  }

  hostConnected() {
    this.service.onTransition((state) => {
      if (state.changed) this.host.requestUpdate();
    });
  }
}

export function connectMachine<
  TContext,
  TEvent extends EventObject,
  TTypestate extends Typestate<TContext> = { value: any; context: TContext }
>(
  host: ReactiveControllerHost,
  machine: StateMachine<TContext, any, TEvent, TTypestate>,
  options: Partial<InterpreterOptions> &
    Partial<MachineOptions<TContext, TEvent>> = {}
) {
  return new MachineController(host, machine, options);
}
