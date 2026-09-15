const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const script = path.join(__dirname, 'typecheck-examples.js');

test('checks only selected projects, handles spaces, and reports failures', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'example checks '));
  try {
    for (const name of ['good project', 'bad project']) {
      const project = path.join(directory, name);
      fs.mkdirSync(project);
      fs.writeFileSync(
        path.join(project, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            target: 'ES2022',
            module: 'NodeNext',
            strict: true,
            types: [],
            skipLibCheck: true
          },
          files: ['index.ts']
        })
      );
      fs.writeFileSync(
        path.join(project, 'index.ts'),
        name.startsWith('good')
          ? 'const value: number = 1;'
          : 'const value: number = "wrong";'
      );
    }
    const good = path.join(directory, 'good project');
    const bad = path.join(directory, 'bad project');
    assert.equal(spawnSync(process.execPath, [script, good]).status, 0);
    const result = spawnSync(process.execPath, [script, bad, good], {
      encoding: 'utf8'
    });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /Checking .*good project/);
    assert.match(result.stderr, /Typecheck failed/);
    assert.equal(spawnSync(process.execPath, [script, directory]).status, 1);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('checks referenced projects behind a solution config without emitting JavaScript', () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'example references ')
  );
  try {
    const child = path.join(directory, 'child project');
    fs.mkdirSync(child);
    fs.writeFileSync(
      path.join(directory, 'tsconfig.json'),
      '// Solution config\n' +
        JSON.stringify({ files: [], references: [{ path: './child project' }] })
    );
    fs.writeFileSync(
      path.join(child, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          strict: true,
          types: [],
          skipLibCheck: true
        },
        files: ['index.ts']
      })
    );
    const source = path.join(child, 'index.ts');
    fs.writeFileSync(source, 'const value: number = "wrong";');
    const bad = spawnSync(process.execPath, [script, directory], {
      encoding: 'utf8'
    });
    assert.equal(bad.status, 1, bad.stdout + bad.stderr);
    assert.match(bad.stdout, /not assignable to type 'number'/);
    fs.writeFileSync(source, 'const value: number = 1;');
    const good = spawnSync(process.execPath, [script, directory], {
      encoding: 'utf8'
    });
    assert.equal(good.status, 0, good.stdout + good.stderr);
    assert.equal(fs.existsSync(path.join(child, 'index.js')), false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
