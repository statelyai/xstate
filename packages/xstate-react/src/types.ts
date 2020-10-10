import { EventObject } from 'xstate';

export type Sender<TEvent extends EventObject> = (event: TEvent) => void;

export interface Subscription {
  unsubscribe(): void;
}

export interface Observer<T> {
  // Sends the next value in the sequence
  next?: (value: T) => void;

  // Sends the sequence error
  error?: (errorValue: any) => void;

  // Sends the completion notification
  complete: () => void;
}

export interface Subscribable<T> {
  subscribe(observer: Observer<T>): Subscription;
  subscribe(
    next: (value: T) => void,
    error?: (error: any) => void,
    complete?: () => void
  ): Subscription;
}

export interface ActorRef<TEvent extends EventObject, TEmitted = any>
  extends Subscribable<TEmitted> {
  send: Sender<TEvent>;
  stop: () => void;
  /**
   * The most recently emitted value.
   */
  current: TEmitted;
  name: string;
}

// Compatibility with V4
export interface ActorRefLike<TEvent extends EventObject, TEmitted = any>
  extends Subscribable<TEmitted> {
  send: Sender<TEvent>;
  stop?: () => void;
  [key: string]: any;
}

export type MaybeLazy<T> = T | (() => T);
