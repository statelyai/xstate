import { Actor, AnyActorRef, OutputFrom } from '.';

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
): Promise<T extends Actor<infer TLogic> ? OutputFrom<TLogic> : unknown> {
  return new Promise((resolve, reject) => {
    actor.subscribe({
      complete: () => {
        resolve(
          actor.getSnapshot().output
          // actor.getOutput()! as T extends Actor<infer TLogic>
          //   ? OutputFrom<TLogic>
          //   : unknown
        );
      },
      error: (err) => {
        reject(err);
      }
    });
  });
}
