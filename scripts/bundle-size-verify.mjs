import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Execute the measured artifact and assert its observable output separately. */
export function verifyBundle({
  name,
  code,
  directory,
  expectedLogs,
  exports = []
}) {
  const executable = join(directory, `${name}.mjs`);
  const harness = join(directory, `${name}.verify.mjs`);
  writeFileSync(executable, code);
  writeFileSync(
    harness,
    `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    globalThis.require = createRequire(import.meta.url);
    const logs = [];
    console.log = (...args) => logs.push(args);
    const result = await import(${JSON.stringify(pathToFileURL(executable).href)});
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(logs, ${JSON.stringify(expectedLogs)});
    for (const name of ${JSON.stringify(exports)}) {
      assert.equal(typeof result[name], 'function', name);
    }
  `
  );
  const execution = spawnSync(process.execPath, [harness], {
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'production' },
    timeout: 5_000
  });
  if (execution.status !== 0) {
    throw new Error(
      `Profile "${name}" failed verification:\n${execution.error?.message ?? execution.stderr ?? execution.stdout}`
    );
  }
}
