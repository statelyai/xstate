import { createMachine } from '..';
import {
  MachineTypes,
  MachineBehavior,
  StateMachineConfig,
  InternalStateFrom,
  Implementations,
  EventFrom,
  ActorContext
} from '../types';

export class StateMachine<T extends MachineTypes>
  implements MachineBehavior<T> {
  public config: StateMachineConfig<T>;
  private _machine: MachineBehavior<T>;
  public initialState: InternalStateFrom<MachineBehavior<T>>;
  public implementations: Implementations<T>;

  constructor(
    config: StateMachineConfig<T>,
    implementations: Implementations<T> = {}
  ) {
    this.config = config;
    this.implementations = implementations;

    // too lazy to copy-paste
    this._machine = createMachine(config);

    this.initialState = this._machine.initialState;
  }

  public transition(
    state: InternalStateFrom<MachineBehavior<T>>,
    event: EventFrom<MachineBehavior<T>>,
    actorCtx?: ActorContext<MachineBehavior<T>>
  ): InternalStateFrom<MachineBehavior<T>> {
    return this._machine.transition(state, event, actorCtx);
  }

  public getSnapshot(
    state: InternalStateFrom<MachineBehavior<T>>
  ): InternalStateFrom<MachineBehavior<T>> {
    return this._machine.getSnapshot(state);
  }

  // these are specific to StateMachine; not part of Behavior interface
  public provide(implementations) {
    return new StateMachine(this.config, implementations);
  }
}
