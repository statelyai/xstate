import type { StateLike, AnyState } from 'xstate';

export function isStateLike(state: any): state is StateLike<any> {
  return (
    typeof state === 'object' &&
    'value' in state &&
    'context' in state &&
    'event' in state &&
    '_event' in state
  );
}

function isState(state: any): state is AnyState {
  return isStateLike(state) && 'can' in state && 'matches' in state;
}

/**
 * Takes in an interpreter or actor ref and returns a State object with reactive
 * methods or if not State, the initial value passed in
 * @param snapshot
 * @param nextSnapshot
 */
export const deriveServiceState = <TSnapshot>(
  snapshot: TSnapshot,
  nextSnapshot: TSnapshot = snapshot
): TSnapshot => {
  if (isState(snapshot) && isStateLike(nextSnapshot)) {
    return {
      ...(nextSnapshot as object),
      toJSON() {
        return snapshot.toJSON();
      },
      toStrings(...args: Parameters<typeof snapshot['toStrings']>) {
        return snapshot.toStrings(args[0], args[1]);
      },
      can(...args: Parameters<typeof snapshot['can']>) {
        // tslint:disable-next-line:no-unused-expression
        this.value; // reads state.value to be tracked
        // tslint:disable-next-line:no-unused-expression
        this.context; // reads state.context to be tracked
        return snapshot.can(args[0]);
      },
      hasTag(...args: Parameters<typeof snapshot['hasTag']>) {
        // tslint:disable-next-line:no-unused-expression
        this.value; // reads state.value to be tracked
        return snapshot.hasTag(args[0]);
      },
      matches(...args: Parameters<typeof snapshot['matches']>) {
        // tslint:disable-next-line:no-unused-expression
        this.value; // reads state.value to be tracked
        return snapshot.matches(args[0] as never);
      }
    } as TSnapshot;
  }
  return nextSnapshot;
};
