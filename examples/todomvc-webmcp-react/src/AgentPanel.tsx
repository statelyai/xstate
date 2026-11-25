import { useState } from 'react';
import type { MockModelContext, WebMCP } from '@xstate/webmcp';
import './AgentPanel.css';

/**
 * Lists the tools agents can call. Without native WebMCP, it also calls them
 * through the in-page model context, the way an agent would.
 */
export function AgentPanel({
  webMCP,
  modelContext
}: {
  webMCP: WebMCP;
  modelContext: MockModelContext | undefined;
}) {
  const [name, setName] = useState(webMCP.tools[0].name);
  const [input, setInput] = useState('{}');
  const [result, setResult] = useState('');
  const tool = webMCP.tools.find((t) => t.name === name)!;

  function run() {
    Promise.resolve()
      .then(() => modelContext!.executeTool(name, JSON.parse(input)))
      .then(
        (value) => setResult(JSON.stringify(value, null, 2)),
        (error: unknown) => setResult(String(error))
      );
  }

  return (
    <aside className="agent-panel">
      <h2>WebMCP tools</h2>
      <p>
        {modelContext
          ? 'This browser has no WebMCP support, so the tools are registered with an in-page model context. Call them below.'
          : 'Registered with document.modelContext. Ask your browser agent to manage the todos.'}
      </p>
      <select
        aria-label="Tool"
        value={name}
        onChange={(ev) => setName(ev.target.value)}
      >
        {webMCP.tools.map((t) => (
          <option key={t.name} value={t.name}>
            {t.name}
          </option>
        ))}
      </select>
      <p className="agent-description">{tool.description}</p>
      <pre>{JSON.stringify(tool.inputSchema, null, 2)}</pre>
      {modelContext && (
        <>
          <textarea
            aria-label="Tool input (JSON)"
            value={input}
            onChange={(ev) => setInput(ev.target.value)}
          />
          <button onClick={run}>Call {name}</button>
          {result && <pre aria-label="Tool result">{result}</pre>}
        </>
      )}
    </aside>
  );
}
