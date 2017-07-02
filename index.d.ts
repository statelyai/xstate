declare namespace xstate {
  export interface StateConfig {
    id?: string;
    initial?: string;
    states?: {
      [state: string]: StateConfig;
    };
    on?: {
      [event: string]: string;
    };
    isMachine?: boolean;
    parallel?: boolean;
  }

  export interface State extends StateConfig {
    id: string;
    toString: () => string;
  }

  export interface Transition extends State {
    from?: StateId;
    action?: Action;
  }

  export type Action =
    | string
    | {
        type: string;
        [key: string]: any;
      };

  export type StatePath = string[];

  export type StateId = string | string[];

  export interface History {
    $current: string;
    [key: string]: History | string; // TODO: remove string
  }

  export interface Machine extends State {
    id: string;
    initial: string;
    transition: (
      stateId: string | StatePath | State | undefined,
      action: Action
    ) => Transition;
    getState: (stateId: string | StatePath | undefined) => State;

    events: string[];
  }
}

declare module 'xstate' {
  export = xstate;
}
