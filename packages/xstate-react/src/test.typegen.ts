// This file was automatically generated. Edits will be overwritten

export interface Typegen0 {
  '@@xstate/typegen': true;
  eventsCausingActions: {
    showAddErrorMessage: 'error.platform.addLike';
    logToConsole: 'done.invoke.removeLike';
    showRemoveErrorMessage: 'error.platform.removeLike';
    refetch: 'done.invoke.addLike' | 'done.invoke.removeLike';
  };
  internalEvents: {
    'error.platform.addLike': { type: 'error.platform.addLike'; data: unknown };
    'done.invoke.removeLike': {
      type: 'done.invoke.removeLike';
      data: unknown;
      __tip: "Provide an event of type { type: 'done.invoke.removeLike'; data: any } to strongly type this";
    };
    'error.platform.removeLike': {
      type: 'error.platform.removeLike';
      data: unknown;
    };
    'done.invoke.addLike': {
      type: 'done.invoke.addLike';
      data: unknown;
      __tip: "Provide an event of type { type: 'done.invoke.addLike'; data: any } to strongly type this";
    };
  };
  invokeSrcNameMap: {
    addLike: 'done.invoke.addLike';
    removeLike: 'done.invoke.removeLike';
  };
  missingImplementations: {
    actions:
      | 'showAddErrorMessage'
      | 'logToConsole'
      | 'showRemoveErrorMessage'
      | 'refetch';
    services: 'addLike' | 'removeLike';
    guards: never;
    delays: never;
  };
  eventsCausingServices: {
    addLike: 'ADD_LIKE';
    removeLike: 'REMOVE_LIKE';
  };
  eventsCausingGuards: {};
  eventsCausingDelays: {};
  matchesStates: 'idle' | 'waitingForRefetch' | 'addPending' | 'removePending';
  tags: 'loading';
}
