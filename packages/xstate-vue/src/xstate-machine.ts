import { interpret, State } from 'xstate';
import Vue, { VNode } from 'vue';

export default Vue.extend({
  render(h): VNode {
    const { current, service, send } = this;
    return h('div', [
      this.$scopedSlots.default({
        current,
        service,
        send
      })
    ]);
  },
  props: {
    machine: {
      type: Object,
      required: true,
      default: () => ({})
    },
    options: {
      type: Object,
      default: () => ({})
    }
  },
  data() {
    return {
      current: null
    };
  },
  computed: {
    initialState() {
      if (!this.service.initialState) return;
      return this.service.initialState;
    },
    actions() {
      return this.options.actions;
    },
    services() {
      return this.options.services;
    }
  },
  created() {
    const {
      context,
      guards,
      actions,
      activities,
      services,
      delays,
      state: rehydratedState,
      ...interpreterOptions
    } = this.options;

    const machineConfig = {
      context,
      guards,
      actions,
      activities,
      services,
      delays
    };

    const machineWithConfig = this.machine.withConfig(machineConfig, {
      ...this.machine.context,
      ...context
    });

    // this.sevice won't be reactive
    this.service = interpret(
      machineWithConfig,
      interpreterOptions
    ).onTransition((state) => {
      if (state.changed) {
        this.$emit('change', state);
        this.current = state;
      }
    });

    this.current = rehydratedState
      ? State.create(rehydratedState)
      : this.service.initialState;
  },
  methods: {
    send(event) {
      return this.service.send(event);
    }
  },
  beforeMount() {
    this.service.start(this.initialState);
  },
  beforeDestroy() {
    this.service.stop();
  }
});
