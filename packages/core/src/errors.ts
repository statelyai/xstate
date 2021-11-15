import { State, StateNode } from '.';

export interface XStateErrorMeta {
  /**
   * The path the error occurred in
   */
  state?: State<any, any>;
  /**
   * If it occurred within a state node, log the state node
   */
  stateNode?: StateNode<any, any>;
}

export class XStateError extends Error {
  meta?: XStateErrorMeta;
  constructor(message: string, meta: XStateErrorMeta) {
    super(message);
    this.meta = meta;
  }
}
