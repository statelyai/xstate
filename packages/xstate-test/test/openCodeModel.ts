// Port of James Long's two-script Code Mode model:
// https://gist.github.com/jlongster/86d4be9094ce9edd060057787e40d173
import { createTestModel } from '../src/paths.ts';

import {
  checkCodeMode,
  isActive,
  maxScripts,
  observe,
  type Action,
  type State
} from './openCodeSpec.ts';

export function createCodeModeModel({ allowTwoForeground = false } = {}) {
  return createTestModel({
    initial: (): State => ({
      fullCodemode: null,
      scripts: [],
      deliveredNotices: []
    }),
    choices(state): Action[] {
      if (state.fullCodemode === null) {
        return [
          { type: 'init', fullCodemode: true },
          { type: 'init', fullCodemode: false }
        ];
      }

      const actions: Action[] = [];
      if (
        state.scripts.length < maxScripts &&
        (allowTwoForeground ||
          !state.scripts.some((script) => script.kind === 'foreground'))
      ) {
        actions.push({ type: 'startExecute' });
      }

      for (const [script, entry] of state.scripts.entries()) {
        if (!isActive(entry)) {
          continue;
        }
        switch (entry.progress) {
          case 'running':
            actions.push(
              { type: 'askPermission', script },
              { type: 'finishScript', script }
            );
            break;
          case 'askingPermission':
            actions.push(
              { type: 'approve', script },
              { type: 'reject', script }
            );
            break;
          case 'approved':
          case 'callFailed':
            actions.push({ type: 'finishScript', script });
            break;
        }
      }

      if (state.scripts.some(isActive)) {
        actions.push({ type: 'tick10s' }, { type: 'ctrlB' }, { type: 'esc' });
      }
      return actions;
    },
    step(state, action): State {
      switch (action.type) {
        case 'init':
          return { ...state, fullCodemode: action.fullCodemode };
        case 'startExecute':
          return {
            ...state,
            scripts: [
              ...state.scripts,
              { kind: 'foreground', progress: 'running' }
            ]
          };
        case 'tick10s':
        case 'ctrlB':
          return state.fullCodemode
            ? {
                ...state,
                scripts: state.scripts.map((script) =>
                  script.kind === 'foreground'
                    ? { ...script, kind: 'background' }
                    : script
                )
              }
            : state;
        case 'esc':
          return {
            ...state,
            scripts: state.scripts.map((script) =>
              script.kind === 'foreground' ? { kind: 'cancelled' } : script
            )
          };
      }

      const { script } = action;
      const current = state.scripts[script];
      if (!current || !isActive(current)) {
        throw new Error(`${action.type} requires an active script`);
      }
      const scripts = [...state.scripts];
      if (action.type === 'askPermission') {
        scripts[script] = { ...current, progress: 'askingPermission' };
      } else if (action.type === 'approve' || action.type === 'reject') {
        scripts[script] = {
          ...current,
          progress: action.type === 'approve' ? 'approved' : 'callFailed'
        };
      } else {
        if (current.progress === 'askingPermission') {
          throw new Error('Cannot finish while waiting for permission');
        }
        const output =
          current.progress === 'approved'
            ? 'approved:ok'
            : current.progress === 'callFailed'
              ? 'call_failed:ok'
              : 'ok';
        if (current.kind === 'background') {
          scripts[script] = { kind: 'backgroundCompleted', output };
          return {
            ...state,
            scripts,
            deliveredNotices: [...state.deliveredNotices, { script, output }]
          };
        }
        scripts[script] = { kind: 'completed', output };
      }
      return { ...state, scripts };
    },
    observe,
    check: checkCodeMode
  });
}
