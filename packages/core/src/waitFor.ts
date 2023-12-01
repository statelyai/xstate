import isDevelopment from '#is-development';
import { ActorRef, SnapshotFrom, Subscription } from './types.ts';

interface WaitForOptions {
  /**
   * How long to wait before rejecting, if no emitted
   * state satisfies the predicate.
   *
   * @defaultValue 10_000 (10 seconds)
   */
  timeout: number;
}

const defaultWaitForOptions: WaitForOptions = {
  timeout: Infinity // much more than 10 seconds
};

/**
 * Subscribes to an actor ref and waits for its emitted value to satisfy
 * a predicate, and then resolves with that value.
 * Will throw if the desired state is not reached after a timeout
 * (defaults to 10 seconds).
 *
 * @example
 * ```js
 * const state = await waitFor(someService, state => {
 *   return state.hasTag('loaded');
 * });
 *
 * state.hasTag('loaded'); // true
 * ```
 *
 * @param actorRef The actor ref to subscribe to
 * @param predicate Determines if a value matches the condition to wait for
 * @param options
 * @returns A promise that eventually resolves to the emitted value
 * that matches the condition
 */
export function waitFor<TActorRef extends ActorRef<any, any>>(
  actorRef: TActorRef,
  predicate: (emitted: SnapshotFrom<TActorRef>) => boolean,
  options?: Partial<WaitForOptions>
): Promise<SnapshotFrom<TActorRef>> {
  const resolvedOptions: WaitForOptions = {
    ...defaultWaitForOptions,
    ...options
  };
  return new Promise((res, rej) => {
    let done = false;
    if (isDevelopment && resolvedOptions.timeout < 0) {
      console.error(
        '`timeout` passed to `waitFor` is negative and it will reject its internal promise immediately.'
      );
    }
    const handle =
      resolvedOptions.timeout === Infinity
        ? undefined
        : setTimeout(() => {
            sub!.unsubscribe();
            rej(new Error(`Timeout of ${resolvedOptions.timeout} ms exceeded`));
          }, resolvedOptions.timeout);

    const dispose = () => {
      clearTimeout(handle!);
      done = true;
      sub?.unsubscribe();
    };

    function checkEmitted(emitted: SnapshotFrom<TActorRef>) {
      if (predicate(emitted)) {
        dispose();
        res(emitted);
      }
    }

    let sub: Subscription | undefined; // avoid TDZ when disposing synchronously

    // See if the current snapshot already matches the predicate
    checkEmitted(actorRef.getSnapshot());
    if (done) {
      return;
    }

    sub = actorRef.subscribe({
      next: checkEmitted,
      error: (err) => {
        dispose();
        rej(err);
      },
      complete: () => {
        dispose();
        rej(new Error(`Actor terminated without satisfying predicate`));
      }
    });
    if (done) {
      sub.unsubscribe();
    }
  });
}
