import {
  Machine,
  Event,
  Action,
  EventObject,
  SendAction,
  CancelAction,
  DefaultExtState
} from './types';
import { State } from './State';
import { toEventObject, actionTypes, toActionObject } from './actions';

export type StateListener = <TExtState = DefaultExtState>(
  state: State<TExtState>
) => void;

export class Interpreter<TExtState> {
  public state: State<TExtState>;
  public extState: TExtState;
  public eventQueue: EventObject[] = [];
  public delayedEventsMap: Record<string | number, NodeJS.Timer> = {};
  public listeners: Set<StateListener> = new Set();
  constructor(public machine: Machine<TExtState>, listener?: StateListener) {
    if (listener) {
      this.onTransition(listener);
    }
  }
  public static interpret = interpret;
  private update(state: State<TExtState>, event?: Event): void {
    this.state = state;

    const updatedState = this.state.actions.reduce<TExtState>(
      (extState, action) => {
        const stateUpdate = this.exec(
          action,
          this.extState,
          event ? toEventObject(event) : undefined
        );

        return stateUpdate
          ? Object.assign({}, extState, stateUpdate)
          : extState;
      },
      this.extState
    );

    if (this.extState && updatedState) {
      Object.assign(this.extState, updatedState);
    }

    this.listeners.forEach(listener => listener(state));
  }
  /**
   * Adds a listener that is called whenever a state transition happens.
   * @param listener
   */
  public onTransition(listener: StateListener): Interpreter<TExtState> {
    this.listeners.add(listener);
    return this;
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
    action: Action<TExtState>,
    extState: TExtState,
    event?: EventObject
  ): Partial<TExtState> | undefined {
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
        // tslint:disable-next-line:no-console
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

export function interpret<TExtState = DefaultExtState>(
  machine: Machine<TExtState>,
  listener: StateListener
) {
  return new Interpreter(machine, listener);
}
