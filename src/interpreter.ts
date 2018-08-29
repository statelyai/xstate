import {
  Machine,
  Event,
  EventObject,
  SendAction,
  CancelAction,
  DefaulTContext,
  ActionObject
} from './types';
import { State } from './State';
import * as actionTypes from './actionTypes';
import { toEventObject } from './actions';

export type StateListener = <TContext = DefaulTContext>(
  state: State<TContext>
) => void;

export class Interpreter<TContext> {
  public state: State<TContext>;
  public extState: TContext;
  public eventQueue: EventObject[] = [];
  public delayedEventsMap: Record<string | number, NodeJS.Timer> = {};
  public listeners: Set<StateListener> = new Set();
  constructor(public machine: Machine<TContext>, listener?: StateListener) {
    if (listener) {
      this.onTransition(listener);
    }
  }
  public static interpret = interpret;
  private update(state: State<TContext>, event?: Event): void {
    this.state = state;
    const { context } = this.state;

    this.state.actions.forEach(action => {
      this.exec(action, context, event ? toEventObject(event) : undefined);
    }, context);

    this.listeners.forEach(listener => listener(state));
  }
  /**
   * Adds a listener that is called whenever a state transition happens.
   * @param listener
   */
  public onTransition(listener: StateListener): Interpreter<TContext> {
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
    action: ActionObject<TContext>,
    extState: TContext,
    event?: EventObject
  ): Partial<TContext> | undefined {
    if (action.exec) {
      return action.exec(extState, event);
    }

    switch (action.type) {
      case actionTypes.send:
        const sendAction = action as SendAction;

        if (!sendAction.delay) {
          this.eventQueue.push(sendAction.event);
        } else {
          this.delayedEventsMap[sendAction.id] = setTimeout(() => {
            this.send(sendAction.event);
          }, sendAction.delay || 0);
        }

        break;
      case actionTypes.cancel:
        this.cancel((action as CancelAction).sendId);

        break;
      default:
        // tslint:disable-next-line:no-console
        console.warn(
          `No implementation found for action type '${action.type}'`
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

export function interpret<TContext = DefaulTContext>(
  machine: Machine<TContext>,
  listener: StateListener
) {
  return new Interpreter(machine, listener);
}
