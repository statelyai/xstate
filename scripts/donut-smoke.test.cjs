const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtemp, readFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');

const example = path.resolve(__dirname, '../examples/persisted-donut-maker');
const cli = require.resolve('vite-node/vite-node.mjs', { paths: [example] });
function start(cwd) {
  const child = spawn(
    process.execPath,
    [cli, '--root', example, path.join(example, 'main.ts')],
    { cwd }
  );
  let output = '';
  child.stdout.on('data', (data) => {
    output += data;
  });
  child.stderr.on('data', (data) => {
    output += data;
  });
  const exited = new Promise((resolve) => child.on('exit', resolve));
  return {
    child,
    exited,
    async waitFor(text) {
      const deadline = Date.now() + 10000;
      while (!output.includes(text)) {
        if (Date.now() > deadline || child.exitCode !== null)
          throw new Error(output);
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }
  };
}

test(
  'CLI saves and restores the current workflow on restart',
  { timeout: 25000 },
  async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), 'donut-reload-'));
    let current;
    try {
      current = start(cwd);
      await current.waitFor('ingredients');
      current.child.stdin.write('NEXT\n');
      await current.waitFor('makeDough');
      current.child.stdin.end();
      assert.equal(await current.exited, 0);
      const snapshot = JSON.parse(
        await readFile(path.join(cwd, 'persisted-state.json'), 'utf8')
      );
      assert.deepEqual(snapshot.value, { directions: 'makeDough' });
      current = start(cwd);
      await current.waitFor('makeDough');
      current.child.stdin.end();
      assert.equal(await current.exited, 0);
    } finally {
      if (current?.child.exitCode === null) {
        current.child.kill('SIGKILL');
        await current.exited;
      }
      await rm(cwd, { recursive: true, force: true });
    }
  }
);
