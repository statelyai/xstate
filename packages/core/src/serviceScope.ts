import { Interpreter } from './interpreter';

/**
 * Maintains a stack of the current service in scope.
 * This is used to provide the correct service to spawn().
 */

const serviceStack = [] as Array<Interpreter<any, any, any> | undefined>;

export const provide = <
  T,
  TService extends Interpreter<any, any, any, any, any>
>(
  service: TService | undefined,
  fn: (service: TService | undefined) => T
) => {
  serviceStack.push(service);
  const result = fn(service);
  serviceStack.pop();
  return result;
};

export const consume = <
  T,
  TService extends Interpreter<any, any, any, any, any>
>(
  fn: (service: TService) => T
) => fn(serviceStack[serviceStack.length - 1] as TService);
