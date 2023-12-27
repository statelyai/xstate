import { createActor } from 'xstate';
import type {
  ActorOptions,
  ActorRefFrom,
  AnyActorLogic,
  SnapshotFrom
} from 'xstate';
import {
  DestroyRef,
  Injector,
  inject,
  runInInjectionContext,
  signal,
  Signal
} from '@angular/core';

interface injectActorOptions {
  injector?: Injector;
}

interface InjectedActor<TLogic extends AnyActorLogic> {
  snapshot: Signal<SnapshotFrom<TLogic>>;
  send: ActorRefFrom<TLogic>['send'];
  ref: ActorRefFrom<TLogic>;
}

export function injectActor<TLogic extends AnyActorLogic>(
  logic: TLogic,
  options?: ActorOptions<TLogic>,
  injectOptions?: injectActorOptions
): InjectedActor<TLogic> {
  const injector = injectOptions?.injector ?? inject(Injector);
  const destroyRef = injector.get(DestroyRef);
  // I'm afraid I stepped into this: https://github.com/angular/angular/issues/34478
  return runInInjectionContext(injector, () => {
    const actorInstance = createActor(logic as any, options).start();

    const snapshot = signal(actorInstance.getSnapshot());
    const result = {
      snapshot,
      send: actorInstance.send,
      ref: actorInstance
    } as any;

    const subscription = actorInstance.subscribe((currentSnapshot) => {
      // result.snapshot = snapshot;
      snapshot.set(currentSnapshot);
    });

    destroyRef.onDestroy(() => {
      actorInstance.stop();
      subscription.unsubscribe();
    });

    return result;
  });
}
