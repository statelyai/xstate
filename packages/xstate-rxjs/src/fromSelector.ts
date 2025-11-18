import { from, Observable } from 'rxjs';
import { distinctUntilChanged, map, startWith } from 'rxjs/operators';
import { ActorRef, Subscribable } from 'xstate';
import { defaultGetSnapshot } from './utils';

const defaultCompare = (a: any, b: any) => a === b;

export function fromSelector<
  TActor extends ActorRef<any, any>,
  T,
  TEmitted = TActor extends Subscribable<infer Emitted> ? Emitted : never
>(
  actor: TActor,
  selector: (emitted: TEmitted) => T,
  compare: (a: T, b: T) => boolean = defaultCompare,
  getSnapshot: (a: TActor) => TEmitted = defaultGetSnapshot
): Observable<T> {
  const snapshot = selector(getSnapshot(actor));

  return from(actor).pipe(
    map((value) => selector(value)),
    startWith(snapshot),
    distinctUntilChanged(compare)
  );
}
