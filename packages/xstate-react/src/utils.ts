import { Interpreter } from 'xstate';

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
  return service.status !== 0 ? service.state : service.machine.initialState;
}
