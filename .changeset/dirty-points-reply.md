---
'xstate': patch
---

The `SpawnedActorRef` TypeScript interface has been deprecated in favor of a unified `ActorRef` interface, which contains the following:

```ts
interface ActorRef<TEvent extends EventObject, TEmitted = any>
  extends Subscribable<TEmitted> {
  send: (event: TEvent) => void;
  id: string;
  subscribe(observer: Observer<T>): Subscription;
  subscribe(
    next: (value: T) => void,
    error?: (error: any) => void,
    complete?: () => void
  ): Subscription;
  getSnapshot: () => TEmitted | undefined;
}
```

For simpler actor-ref-like objects, the `BaseActorRef<TEvent>` interface has been introduced.

```ts
interface BaseActorRef<TEvent extends EventObject> {
  send: (event: TEvent) => void;
}
```
