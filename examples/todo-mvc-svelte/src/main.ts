import 'todomvc-common/base.css';
import 'todomvc-app-css/index.css';

import App from './App.svelte';

import { inspect } from '@xstate/inspect';

inspect({
  iframe: false
});

const app = new App({
  target: document.body
});

export default app;
