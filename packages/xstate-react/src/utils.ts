import {
  AnyInterpreter,
  AnyState,
  Interpreter,
  InterpreterStatus
} from 'xstate';

export function partition<T, A extends T, B extends T>(
  items: T[],
  predicate: (item: T) => item is A
): [A[], B[]] {
  const [truthy, falsy] = [[], []] as [A[], B[]];

  for (const item of items) {
    if (predicate(item)) {
      truthy.push(item);
    } else {
      falsy.push(item as B);
    }
  }

  return [truthy, falsy];
}

export function getServiceSnapshot<
  TService extends Interpreter<any, any, any, any>
>(service: TService): TService['state'] {
  return service.status !== 0
    ? service.getSnapshot()
    : service.machine.initialState;
}

// From https://github.com/reduxjs/react-redux/blob/master/src/utils/shallowEqual.ts
function is(x: unknown, y: unknown) {
  if (x === y) {
    return x !== 0 || y !== 0 || 1 / x === 1 / y;
  } else {
    return x !== x && y !== y;
  }
}

export function shallowEqual(objA: any, objB: any) {
  if (is(objA, objB)) return true;

  if (
    typeof objA !== 'object' ||
    objA === null ||
    typeof objB !== 'object' ||
    objB === null
  ) {
    return false;
  }

  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) return false;

  for (let i = 0; i < keysA.length; i++) {
    if (
      !Object.prototype.hasOwnProperty.call(objB, keysA[i]) ||
      !is(objA[keysA[i]], objB[keysA[i]])
    ) {
      return false;
    }
  }

  return true;
}

export function isService(
  actor: any
): actor is Interpreter<any, any, any, any> {
  return 'state' in actor && 'machine' in actor;
}

export function isInterpreterStateEqual(
  service: AnyInterpreter,
  prevState: AnyState,
  nextState: AnyState
) {
  if (service.status === InterpreterStatus.NotStarted) {
    return true;
  }

  // Only change the current state if:
  // - the incoming state is the "live" initial state (since it might have new actors)
  // - OR the incoming state actually changed.
  //
  // The "live" initial state will have .changed === undefined.
  const initialStateChanged =
    nextState.changed === undefined &&
    (Object.keys(nextState.children).length > 0 ||
      typeof prevState.changed === 'boolean');

  return !(nextState.changed || initialStateChanged);
}
