import App from './App.svelte';

import 'todomvc-common/base.css';
import 'todomvc-app-css/index.css';

import { inspect } from '@xstate/inspect';

inspect({
  iframe: false
});

const app = new App({
  target: document.getElementById('app')
});

export default app;
