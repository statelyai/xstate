import { EventObject, MachineContext } from '../types.ts';
import { AnyActorContext } from '../index.ts';

export class BuiltinAction<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TEvent extends EventObject
> {
  constructor(protected _execContext: AnyActorContext) {}
}
