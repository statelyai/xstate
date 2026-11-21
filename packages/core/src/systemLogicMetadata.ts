import type { AnyEventObject } from './types.ts';

/** Static scheduling metadata on actor definitions, never on live actors. @internal */
export const systemLogicMetadata = Symbol('xstate.systemLogicMetadata');

/** @internal */
export interface SimulationLogicMetadata {
  [systemLogicMetadata]?: {
    simulationCompletionEvent?: (output: unknown) => AnyEventObject;
  };
}
