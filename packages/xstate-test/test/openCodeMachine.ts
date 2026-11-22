import { createMachine, types, type SnapshotFrom } from 'xstate';
import {
  isActive,
  maxScripts,
  type Progress,
  type State
} from './openCodeSpec.ts';

type ContextUpdate = { context: Partial<State> } | undefined;

function replaceScript(
  context: State,
  index: number,
  script: State['scripts'][number]
) {
  return context.scripts.map((current, slot) =>
    slot === index ? script : current
  );
}

function changeProgress(from: Progress, to: Progress) {
  return ({
    context,
    event
  }: {
    context: State;
    event: { script: number };
  }): ContextUpdate => {
    const script = context.scripts[event.script];
    if (script && isActive(script) && script.progress === from) {
      return {
        context: {
          scripts: replaceScript(context, event.script, {
            ...script,
            progress: to
          })
        }
      };
    }
  };
}

function handoff({ context }: { context: State }): ContextUpdate {
  if (context.scripts.some(isActive)) {
    return {
      context: context.fullCodemode
        ? {
            scripts: context.scripts.map((script) =>
              script.kind === 'foreground'
                ? { ...script, kind: 'background' }
                : script
            )
          }
        : {}
    };
  }
}

export const codeModeMachine = createMachine({
  id: 'opencode-codemode',
  schemas: {
    context: types<State>(),
    events: {
      init: types<{ fullCodemode: boolean }>(),
      startExecute: types<{}>(),
      tick10s: types<{}>(),
      ctrlB: types<{}>(),
      esc: types<{}>(),
      askPermission: types<{ script: number }>(),
      approve: types<{ script: number }>(),
      reject: types<{ script: number }>(),
      finishScript: types<{ script: number }>()
    }
  },
  context: (): State => ({
    fullCodemode: null,
    scripts: [],
    deliveredNotices: []
  }),
  initial: 'unconfigured',
  states: {
    unconfigured: {
      on: {
        init: ({ event }) => ({
          target: 'ready',
          context: { fullCodemode: event.fullCodemode }
        })
      }
    },
    ready: {
      on: {
        startExecute: ({ context }): ContextUpdate => {
          if (
            context.scripts.length < maxScripts &&
            !context.scripts.some((script) => script.kind === 'foreground')
          ) {
            return {
              context: {
                scripts: [
                  ...context.scripts,
                  { kind: 'foreground', progress: 'running' }
                ]
              }
            };
          }
        },
        ctrlB: handoff,
        tick10s: handoff,
        esc: ({ context }): ContextUpdate => {
          if (context.scripts.some(isActive)) {
            return {
              context: {
                scripts: context.scripts.map((script) =>
                  script.kind === 'foreground' ? { kind: 'cancelled' } : script
                )
              }
            };
          }
        },
        askPermission: changeProgress('running', 'askingPermission'),
        approve: changeProgress('askingPermission', 'approved'),
        reject: changeProgress('askingPermission', 'callFailed'),
        finishScript: ({ context, event }): ContextUpdate => {
          const script = context.scripts[event.script];
          if (
            !script ||
            !isActive(script) ||
            script.progress === 'askingPermission'
          ) {
            return;
          }

          const output =
            script.progress === 'approved'
              ? 'approved:ok'
              : script.progress === 'callFailed'
                ? 'call_failed:ok'
                : 'ok';
          const isBackground = script.kind === 'background';
          return {
            context: {
              scripts: replaceScript(context, event.script, {
                kind: isBackground ? 'backgroundCompleted' : 'completed',
                output
              }),
              deliveredNotices: isBackground
                ? [
                    ...context.deliveredNotices,
                    { script: event.script, output }
                  ]
                : context.deliveredNotices
            }
          };
        }
      }
    }
  }
});

type CodeModeSnapshot = SnapshotFrom<typeof codeModeMachine>;

const scriptCases = ({ context }: CodeModeSnapshot) =>
  context.scripts.map((_, script) => ({ script }));

export const codeModeCases = {
  init: [{ fullCodemode: true }, { fullCodemode: false }],
  askPermission: scriptCases,
  approve: scriptCases,
  reject: scriptCases,
  finishScript: scriptCases
};
