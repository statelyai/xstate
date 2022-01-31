// This file was automatically generated. Edits will be overwritten

export interface Typegen0 {
  '@@xstate/typegen': true;
  eventsCausingActions: {
    'Assign id to context': 'done.invoke.Create user';
    'Throw error': 'error.platform.Create user';
  };
  internalEvents: {
    'done.invoke.Create user': {
      type: 'done.invoke.Create user';
      data: unknown;
      __tip: 'See the XState TS docs to learn how to strongly type this.';
    };
    'error.platform.Create user': {
      type: 'error.platform.Create user';
      data: unknown;
    };
    'xstate.init': { type: 'xstate.init' };
  };
  invokeSrcNameMap: {
    'Create user': 'done.invoke.Create user';
  };
  missingImplementations: {
    actions: 'Assign id to context' | 'Throw error';
    services: 'Create user';
    guards: never;
    delays: never;
  };
  eventsCausingServices: {
    'Create user': 'error.platform.Create user';
  };
  eventsCausingGuards: {};
  eventsCausingDelays: {};
  matchesStates: 'Creating user' | 'User created';
  tags: never;
}
