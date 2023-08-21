import { Actor, ActorRef, AnyActor, AnyActorRef, OutputFrom, TODO } from '.';

export function toPromise<T extends AnyActorRef>(
  actor: T
): Promise<T extends Actor<infer TLogic> ? OutputFrom<TLogic> : unknown> {
  return new Promise((resolve, reject) => {
    actor.subscribe({
      complete: () => {
        const statusObj = actor.getStatus();
        resolve((statusObj as TODO).output);
      },
      error: (err) => {
        reject(err);
      }
    });
  });
}
