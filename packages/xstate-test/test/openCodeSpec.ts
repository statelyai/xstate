export type Action =
  | { type: 'init'; fullCodemode: boolean }
  | { type: 'startExecute' | 'tick10s' | 'ctrlB' | 'esc' }
  | {
      type: 'askPermission' | 'approve' | 'reject' | 'finishScript';
      script: number;
    };

export type Progress =
  | 'running'
  | 'askingPermission'
  | 'approved'
  | 'callFailed';
type ActiveScript = { kind: 'foreground' | 'background'; progress: Progress };
type Script =
  | ActiveScript
  | { kind: 'completed' | 'backgroundCompleted'; output: string }
  | { kind: 'cancelled' };
type Notice = { script: number; output: string };
type ToolOutput =
  | { status: 'running' | 'receipt' | 'cancelled' }
  | { status: 'completed'; value: string };

export interface Observation {
  turnBlocked: boolean;
  toolResults: ToolOutput[];
  pendingPermissions: number[];
  backgroundJobs: number[];
  deliveredNotices: Notice[];
}

export interface State {
  fullCodemode: boolean | null;
  scripts: Script[];
  deliveredNotices: Notice[];
}

export const maxScripts = 2;

export function isActive(script: Script): script is ActiveScript {
  return script.kind === 'foreground' || script.kind === 'background';
}

export function observe(state: State): Observation {
  return {
    turnBlocked: state.scripts.some((script) => script.kind === 'foreground'),
    toolResults: state.scripts.map((script) => {
      switch (script.kind) {
        case 'foreground':
          return { status: 'running' };
        case 'background':
        case 'backgroundCompleted':
          return { status: 'receipt' };
        case 'completed':
          return { status: 'completed', value: script.output };
        case 'cancelled':
          return { status: 'cancelled' };
      }
    }),
    pendingPermissions: state.scripts.flatMap((script, index) =>
      isActive(script) && script.progress === 'askingPermission' ? [index] : []
    ),
    backgroundJobs: state.scripts.flatMap((script, index) =>
      script.kind === 'background' ? [index] : []
    ),
    deliveredNotices: state.deliveredNotices
  };
}

export function checkCodeMode(state: State) {
  if (
    state.scripts.filter((script) => script.kind === 'foreground').length > 1
  ) {
    throw new Error('codemode.single-foreground-blocker');
  }
  for (const [index, script] of state.scripts.entries()) {
    if (
      state.fullCodemode === false &&
      (script.kind === 'background' || script.kind === 'backgroundCompleted')
    ) {
      throw new Error('codemode.flag-off-stays-foreground');
    }
    const notices = state.deliveredNotices.filter(
      (notice) => notice.script === index
    );
    if (notices.length !== Number(script.kind === 'backgroundCompleted')) {
      throw new Error('codemode.delivered-once-on-background-finish');
    }
  }
}
