import {
  Machine,
  Event,
  Action,
  EventObject,
  SendAction,
  CancelAction
} from './types';
import { State } from './State';
import { toEventObject, actionTypes, toActionObject } from './actions';

export type StateListener = (state: State) => void;

export class Interpreter<T extends {} | undefined> {
  public state: State;
  public extState: T;
  public eventQueue: EventObject[] = [];
  public delayedEventsMap: Record<string | number, NodeJS.Timer> = {};
  public listeners: Set<StateListener> = new Set();
  constructor(public machine: Machine, listener?: StateListener) {
    if (listener) {
      this.listeners.add(listener);
    }
  }
  public static interpret = interpret;
  private update(state: State, event?: Event): void {
    this.state = state;

    const updatedState = this.state.actions.reduce<T>((extState, action) => {
      const stateUpdate = this.exec(
        action,
        this.extState,
        event ? toEventObject(event) : undefined
      );

      return stateUpdate ? Object.assign({}, extState, stateUpdate) : extState;
    }, this.extState);

    if (this.extState && updatedState) {
      Object.assign(this.extState, updatedState);
    }

    this.listeners.forEach(listener => listener(state));
  }
  public init(): void {
    this.update(this.machine.initialState);
  }
  public send(event: Event): void {
    const nextState = this.machine.transition(this.state, event, this.extState);

    this.update(nextState, event);
    this.flushEventQueue();
  }
  private cancel(sendId: string | number): void {
    clearTimeout(this.delayedEventsMap[sendId]);
    delete this.delayedEventsMap[sendId];
  }
  private exec(
    action: Action,
    extState: T,
    event?: EventObject
  ): Partial<T> | undefined {
    if (typeof action === 'function') {
      return action(extState, event);
    }

    const actionObject = toActionObject(action);

    switch (actionObject.type) {
      case actionTypes.send:
        const sendAction = actionObject as SendAction;

        if (!sendAction.delay) {
          this.eventQueue.push(sendAction.event);
        } else {
          this.delayedEventsMap[sendAction.id] = setTimeout(() => {
            this.send(sendAction.event);
          }, sendAction.delay || 0);
        }

        break;
      case actionTypes.cancel:
        this.cancel((actionObject as CancelAction).sendId);

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
