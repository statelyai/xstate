import { Actor, ActorRef, AnyActor, AnyActorRef, OutputFrom } from '.';

export function toPromise<T extends AnyActorRef>(
  actor: T
): Promise<T extends Actor<infer TLogic> ? OutputFrom<TLogic> : unknown> {
  return new Promise((resolve, reject) => {
    actor.subscribe({
      complete: () => {
        resolve(
          actor.getOutput()! as T extends Actor<infer TLogic>
            ? OutputFrom<TLogic>
            : unknown
        );
      },
      error: (err) => {
        reject(err);
      }
    });
  });
}
