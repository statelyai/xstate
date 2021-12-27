import { AnyInterpreter } from './types';

/**
 * Maintains a stack of the current service in scope.
 * This is used to provide the correct service to spawn().
 */

const serviceStack = [] as Array<AnyInterpreter | undefined>;

export const provide = <T, TService extends AnyInterpreter>(
  service: TService | undefined,
  fn: (service: TService | undefined) => T
) => {
  serviceStack.push(service);
  const result = fn(service);
  serviceStack.pop();
  return result;
};

export const consume = <T, TService extends AnyInterpreter>(
  fn: (service: TService) => T
) => fn(serviceStack[serviceStack.length - 1] as TService);
