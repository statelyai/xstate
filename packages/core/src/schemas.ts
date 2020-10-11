import { EventObject } from './types';

export const actionSchema = <TAction extends { type: string }>(
  fn?: (action: TAction) => any
) => fn;

export const eventSchema = <TEvent extends EventObject>(
  fn?: (event: TEvent) => any
) => fn;

export const createContext = <TContext extends {}>(
  context: TContext
): TContext => context;
