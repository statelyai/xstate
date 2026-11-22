import type { TestModelDriver } from '../src/paths.ts';
import type { Action, Observation } from './openCodeSpec.ts';

// In-memory stand-in for a CLI driver. It records visible results and jobs
// independently of the specification's state and transition functions.
export function createCodeModeDriver({ duplicateNotice = false } = {}) {
  const results: Observation['toolResults'] = [];
  const notices: Observation['deliveredNotices'] = [];
  const pending = new Set<number>();
  const jobs = new Set<number>();
  const resolvedOutputs = new Map<number, string>();
  let fullCodemode = false;
  let foreground: number | undefined;

  return {
    send(action) {
      switch (action.type) {
        case 'init':
          fullCodemode = action.fullCodemode;
          break;
        case 'startExecute':
          foreground = results.length;
          results.push({ status: 'running' });
          break;
        case 'tick10s':
        case 'ctrlB':
          if (fullCodemode && foreground !== undefined) {
            results[foreground] = { status: 'receipt' };
            jobs.add(foreground);
            foreground = undefined;
          }
          break;
        case 'esc':
          if (foreground !== undefined) {
            results[foreground] = { status: 'cancelled' };
            pending.delete(foreground);
            foreground = undefined;
          }
          break;
        case 'askPermission':
          pending.add(action.script);
          break;
        case 'approve':
        case 'reject':
          if (!pending.delete(action.script)) {
            break;
          }
          resolvedOutputs.set(
            action.script,
            action.type === 'approve' ? 'approved:ok' : 'call_failed:ok'
          );
          break;
        case 'finishScript': {
          const script = action.script;
          const output = resolvedOutputs.get(script) ?? 'ok';
          if (jobs.delete(script)) {
            notices.push({ script, output });
            if (duplicateNotice) {
              notices.push({ script, output });
            }
          } else {
            results[script] = { status: 'completed', value: output };
            foreground = undefined;
          }
          break;
        }
      }
    },
    read() {
      return {
        turnBlocked: foreground !== undefined,
        toolResults: [...results],
        pendingPermissions: [...pending].sort((a, b) => a - b),
        backgroundJobs: [...jobs].sort((a, b) => a - b),
        deliveredNotices: [...notices]
      };
    }
  } satisfies TestModelDriver<Action, Observation>;
}
