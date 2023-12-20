import {
  ActorOptions,
  ActorRefFrom,
  AnyActorLogic,
  SnapshotFrom,
  createActor
} from 'xstate';
import {
  DestroyRef,
  Injector,
  assertInInjectionContext,
  inject,
  runInInjectionContext,
  signal,
  effect
} from '@angular/core';

interface injectActorOptions {
  injector?: Injector;
}

interface ActorWrapper<TLogic extends AnyActorLogic> {
  snapshot: SnapshotFrom<TLogic>;
  send: ActorRefFrom<TLogic>['send'];
  ref: ActorRefFrom<TLogic>;
}

export function injectActor<TLogic extends AnyActorLogic>(
  logic: TLogic,
  options?: ActorOptions<TLogic>,
  injectOptions?: injectActorOptions
): ActorWrapper<TLogic> {
  // assertInInjectionContext(injectActor);
  const injector = injectOptions?.injector ?? inject(Injector);
  const destroyRef = injector.get(DestroyRef);
  // I'm afraid I stepped into this: https://github.com/angular/angular/issues/34478
  return runInInjectionContext(injector, () => {
    const actorInstance = createActor(logic as any, options).start();

    const result = {
      snapshot: actorInstance.getSnapshot(),
      send: actorInstance.send,
      ref: actorInstance
    } as any;

    const subscription = actorInstance.subscribe((snapshot) => {
      result.snapshot = snapshot;
    });

    destroyRef.onDestroy(() => {
      actorInstance.stop();
      subscription.unsubscribe();
    });

    return result;
  });
}
// #actorA = injectActor(logicA)
// #actorB = injectActor(logicB)
