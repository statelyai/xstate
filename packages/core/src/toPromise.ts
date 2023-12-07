import { AnyActorRef, OutputFrom } from './types.ts';

/**
 * Returns a promise that resolves to the `output` of the actor when it is done.
 *
 * @example
 * ```ts
 * const machine = createMachine({
 *   // ...
 *   output: {
 *     count: 42
 *   }
 * });
 *
 * const actor = createActor(machine);
 *
 * actor.start();
 *
 * const output = await toPromise(actor);
 *
 * console.log(output);
 * // logs { count: 42 }
 * ```
 */
export function toPromise<T extends AnyActorRef>(
  actor: T
): Promise<OutputFrom<T>> {
  // TODO: this is typed as `any`
  const currentSnapshot = actor.getSnapshot();

  if (currentSnapshot.status === 'done') {
    return Promise.resolve(currentSnapshot.output);
  }

  if (currentSnapshot.status === 'error') {
    return Promise.reject(currentSnapshot.error);
  }

  return new Promise((resolve, reject) => {
    actor.subscribe({
      complete: () => {
        resolve(actor.getSnapshot().output);
      },
      error: reject
    });
  });
}
