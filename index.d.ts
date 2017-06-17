declare namespace xstate {
  export interface StateConfig {
    id?: string;
    initial?: string;
    final?: boolean;
    states?: {
      [state: string]: StateConfig;
    };
    on?: {
      [event: string]: string;
    };
  }

  export interface State extends StateConfig {
    id: string;
    toString: () => string;
  }

  export interface Transition extends State {
    from?: string | string[];
    action?: Action;
  }

  export type Action = string | {
    type: string,
    [key: string]: any,
  };

  export type StatePath = string[];

  export interface Machine extends State {
    id: string;
    initial: string;
    transition: (stateId: string | StatePath | State | undefined, action: Action) => Transition;
    getState: (stateId: string | StatePath | undefined) => State;
    
    events: string[];
  }
}

declare module "xstate" {
  export = xstate;
}
