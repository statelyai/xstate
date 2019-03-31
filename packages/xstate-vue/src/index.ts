/// <reference types="vue" />
import { interpret } from 'xstate';

const plugin: Vue.PluginObject<any> = {
  install: Vue => {
    Vue.mixin({
      created() {
        const { machine, actions } = this.$options;

        if (!machine) {
          return;
        }

        this.$state = machine.initialState;

        (Vue as any).util.defineReactive(this, '$state');
        this.$service = interpret(machine.withConfig({ actions }))
          .onTransition(state => {
            this.$state = state;
          })
          .start();

        this.$send = this.$service.send;
      }
    });
  }
};

export default plugin;
