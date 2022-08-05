import React from 'react';
import ReactDOM from 'react-dom';

import 'todomvc-common/base.css';
import 'todomvc-app-css/index.css';

import { inspect } from '@xstate/inspect';

inspect({
  iframe: false
});

import App from './App';

ReactDOM.render(<App />, document.getElementById('root'));
