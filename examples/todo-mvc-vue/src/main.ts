import { createApp } from 'vue';
import App from './App.vue';
import { inspect } from '@xstate/inspect';

import 'todomvc-common/base.css';
import 'todomvc-app-css/index.css';

inspect({
  iframe: false
});

createApp(App).mount('#app');
