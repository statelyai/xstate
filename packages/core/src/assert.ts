import { GuardDefinition } from './types';

export interface GuardOf<
  TType extends string,
  TParams extends { [key: string]: any } = {}
> extends GuardDefinition<any, any> {
  type: TType;
  params: {
    type: TType;
  } & TParams;
}

export interface GuardWithParams<T extends { [key: string]: any } = {}>
  extends GuardDefinition<any, any> {
  type: string;
  params: {
    type: string;
  } & T;
}

export function assertGuard<T extends GuardDefinition<any, any>>(
  // @ts-ignore
  guardDef: GuardDefinition<any, any>
): asserts guardDef is T {
  return;
}
