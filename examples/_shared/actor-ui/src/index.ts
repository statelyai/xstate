import type { AnyActorRef, SnapshotFrom } from 'xstate';

export interface ActorUIOptions {
  /** Title shown at the top of the panel. */
  title?: string;
  /**
   * Event types to render buttons for. If omitted, they are derived from the
   * actor's logic when it is a state machine (`machine.events`).
   */
  events?: string[];
  /** Max number of entries kept in the event log. Defaults to 50. */
  logLimit?: number;
}

export interface ActorUI {
  /** Unsubscribes and removes the UI from the DOM. */
  destroy(): void;
}

function stringifyStateValue(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

function safeJSON(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

function getEventTypes(actor: AnyActorRef, options: ActorUIOptions): string[] {
  if (options.events) {
    return options.events;
  }
  const logic = (actor as { logic?: unknown }).logic as
    | { events?: unknown }
    | undefined;
  const events = logic?.events;
  return Array.isArray(events)
    ? events.filter((e): e is string => typeof e === 'string' && e !== '*')
    : [];
}

const STYLES: Record<string, string> = {
  root: 'font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;background:#14161a;color:#e6e6e6;border:1px solid #2a2f37;border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:10px;max-width:480px;',
  title: 'font-weight:600;font-size:13px;color:#9fb4ff;letter-spacing:.04em;',
  label:
    'font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#7d8795;margin-bottom:4px;',
  pre: 'margin:0;padding:8px;background:#0e1013;border:1px solid #22262e;border-radius:6px;white-space:pre-wrap;word-break:break-word;max-height:180px;overflow:auto;',
  buttons: 'display:flex;flex-wrap:wrap;gap:6px;',
  button:
    'font:inherit;background:#232833;color:#e6e6e6;border:1px solid #39414f;border-radius:5px;padding:4px 10px;cursor:pointer;',
  log: 'margin:0;padding:8px;background:#0e1013;border:1px solid #22262e;border-radius:6px;height:120px;overflow:auto;list-style:none;',
  logItem: 'padding:1px 0;color:#b9c2cf;border-bottom:1px solid #191c22;'
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  style?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (style) node.setAttribute('style', style);
  if (text !== undefined) node.textContent = text;
  return node;
}

function section(labelText: string, body: HTMLElement): HTMLElement {
  const wrapper = el('div');
  wrapper.append(el('div', STYLES.label, labelText), body);
  return wrapper;
}

/**
 * Mounts a minimal dashboard for any XState actor: current state value,
 * context, an event log, and a button per sendable event type.
 */
export function mountActorUI(
  actor: AnyActorRef,
  element: HTMLElement,
  options: ActorUIOptions = {}
): ActorUI {
  const logLimit = options.logLimit ?? 50;

  const root = el('div', STYLES.root);
  root.append(el('div', STYLES.title, options.title ?? 'Actor'));

  const stateEl = el('pre', STYLES.pre);
  const contextEl = el('pre', STYLES.pre);
  const logEl = el('ul', STYLES.log);
  const buttonsEl = el('div', STYLES.buttons);

  root.append(
    section('State', stateEl),
    section('Context', contextEl),
    section('Events', buttonsEl),
    section('Log', logEl)
  );
  element.append(root);

  const log = (text: string) => {
    const item = el(
      'li',
      STYLES.logItem,
      `${new Date().toLocaleTimeString()}  ${text}`
    );
    logEl.append(item);
    while (logEl.childElementCount > logLimit) {
      logEl.firstElementChild!.remove();
    }
    logEl.scrollTop = logEl.scrollHeight;
  };

  const buttons: Array<[string, HTMLButtonElement]> = [];
  for (const type of getEventTypes(actor, options)) {
    const button = el('button', STYLES.button, type);
    button.type = 'button';
    button.addEventListener('click', () => {
      log(`→ ${type}`);
      actor.send({ type });
    });
    buttonsEl.append(button);
    buttons.push([type, button]);
  }
  if (!buttons.length) {
    buttonsEl.append(
      el(
        'div',
        'color:#7d8795;',
        'No event types available (pass options.events)'
      )
    );
  }

  const render = (snapshot: SnapshotFrom<AnyActorRef>) => {
    const anySnapshot = snapshot as {
      value?: unknown;
      context?: unknown;
      status: string;
      can?: (event: { type: string }) => boolean;
    };
    stateEl.textContent =
      anySnapshot.value === undefined
        ? anySnapshot.status
        : `${stringifyStateValue(anySnapshot.value)}  (${anySnapshot.status})`;
    contextEl.textContent =
      anySnapshot.context === undefined ? '—' : safeJSON(anySnapshot.context);

    for (const [type, button] of buttons) {
      const enabled =
        anySnapshot.status === 'active' &&
        (anySnapshot.can ? anySnapshot.can({ type }) : true);
      button.disabled = !enabled;
      button.style.opacity = enabled ? '1' : '0.4';
    }
  };

  const subscription = actor.subscribe({
    next: (snapshot) => {
      render(snapshot);
      const value = (snapshot as { value?: unknown }).value;
      log(
        `state: ${value === undefined ? snapshot.status : stringifyStateValue(value)}`
      );
    },
    error: (err) => log(`error: ${String(err)}`),
    complete: () => log('done')
  });

  render(actor.getSnapshot());

  return {
    destroy() {
      subscription.unsubscribe();
      root.remove();
    }
  };
}
