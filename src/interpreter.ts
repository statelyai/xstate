import { Machine, Event, Action, EventObject, SendAction } from './types';
import { State } from './State';
import { toEventObject, actionTypes, toActionObject } from './actions';

export type StateListener = (state: State) => void;

export class Interpreter<T extends {} | undefined> {
  public state: State;
  public externalState: T;
  public eventQueue: EventObject[] = [];
  public listeners: Set<StateListener> = new Set();
  constructor(public machine: Machine, listener?: StateListener) {
    if (listener) {
      this.listeners.add(listener);
    }
  }
  public static interpret = interpret;
  private update(state: State, event?: Event): void {
    this.state = state;

    const updatedState = this.state.actions.reduce<T>(
      (externalState, action) => {
        const stateUpdate = this.exec(
          action,
          this.externalState,
          event ? toEventObject(event) : undefined
        );

        return stateUpdate
          ? Object.assign({}, externalState, stateUpdate)
          : externalState;
      },
      this.externalState
    );

    if (this.externalState && updatedState) {
      Object.assign(this.externalState, updatedState);
    }

    this.listeners.forEach(listener => listener(state));
  }
  public init(): void {
    this.update(this.machine.initialState);
  }
  public send(event: Event): void {
    const nextState = this.machine.transition(this.state, event);

    this.update(nextState, event);
    this.flushEventQueue();
  }
  private exec(
    action: Action,
    externalState: T,
    event?: EventObject
  ): Partial<T> | undefined {
    if (typeof action === 'function') {
      return action(externalState, event);
    }

    const actionObject = toActionObject(action);

    switch (actionObject.type) {
      case actionTypes.send:
        const sendAction = actionObject as SendAction;

        if (!sendAction.delay) {
          this.eventQueue.push(sendAction.event);
        } else {
          setTimeout(() => {
            this.send(sendAction.event);
          }, sendAction.delay || 0);
        }

        break;
      default:
        console.warn(
          `No implementation found for action type '${actionObject.type}'`
        );
        break;
    }

    return undefined;
  }
  private flushEventQueue() {
    if (this.eventQueue.length) {
      this.send(this.eventQueue.unshift());
    }
  }
}

export function interpret(machine: Machine, listener: StateListener) {
  return new Interpreter(machine, listener);
}
