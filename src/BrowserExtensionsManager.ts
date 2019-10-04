export default class BrowserExtensionsManager {
  private reduxDevtoolsObject: any;
  private xstateDevtoolsObject: any;

  constructor({ devToolsOptions, id, machine }) {
    if (typeof window !== 'undefined') {
      const reduxDevtools = (<any>window).__REDUX_DEVTOOLS_EXTENSION__;
      const xstateDevtools = (<any>window).__XSTATE_DEVTOOLS_EXTENSION__;

      if (reduxDevtools) {
        const reduxDevToolsOptions =
          typeof devToolsOptions === 'object' ? devToolsOptions : undefined;

        this.reduxDevtoolsObject = reduxDevtools.connect({
          name: id,
          autoPause: true,
          stateSanitizer: state => {
            return {
              value: state.value,
              context: state.context,
              actions: state.actions
            };
          },
          ...reduxDevToolsOptions,
          features: {
            jump: false,
            skip: false,
            ...(reduxDevToolsOptions
              ? reduxDevToolsOptions.features
              : undefined)
          }
        });

        this.reduxDevtoolsObject.init(undefined);
      }
      if (xstateDevtools) {
        this.xstateDevtoolsObject = xstateDevtools.connect({
          machine: machine,
          state: machine.initialState
        });
      }
    }
  }

  update({ state, event }) {
    if (this.reduxDevtoolsObject) {
      this.reduxDevtoolsObject.send(event, state);
    }
    if (this.xstateDevtoolsObject) {
      this.xstateDevtoolsObject.send(state);
    }
  }
}
