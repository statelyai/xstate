import { Machine, Event } from './types';
import { State } from './State';

export type StateListener = (state: State) => void;

export class Interpreter {
  public state: State;
  public listeners: Set<StateListener> = new Set();
  constructor(public machine: Machine, listener?: StateListener) {
    if (listener) {
      this.listeners.add(listener);
    }
  }
  private update(state: State): void {
    this.state = state;

    this.listeners.forEach(listener => listener(state));
  }
  public init(): void {
    this.update(this.machine.initialState);
  }
  public send(event: Event): void {
    const nextState = this.machine.transition(this.state, event);

    this.update(nextState);
  }
}

export function interpret(machine: Machine, listener: StateListener) {
  return new Interpreter(machine, listener);
}
