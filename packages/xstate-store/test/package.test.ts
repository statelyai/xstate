import { execFileSync, spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const compilerPackage = require.resolve('typescript/package.json');
const compilerManifest = JSON.parse(readFileSync(compilerPackage, 'utf8'));
const compiler = resolve(
  dirname(compilerPackage),
  compilerManifest.bin.tsc ?? compilerManifest.bin.tsc6
);
const nodeTypes = dirname(dirname(require.resolve('@types/node/package.json')));

function copyPackage(source: string, destination: string) {
  mkdirSync(destination, { recursive: true });
  cpSync(join(source, 'package.json'), join(destination, 'package.json'));
  cpSync(join(source, 'dist'), join(destination, 'dist'), { recursive: true });
}

it('supports strict public package consumers with and without XState', () => {
  const root = mkdtempSync(join(tmpdir(), 'xstate-store-package-'));
  const consumer = join(root, 'consumer');
  const childEnvironment = { ...process.env, NODE_PATH: '' };
  try {
    mkdirSync(consumer);
    copyPackage(packageRoot, join(root, 'node_modules/@xstate/store'));
    const source = readFileSync(
      join(packageRoot, 'test/package/core.mts.txt'),
      'utf8'
    );

    function compile(
      fixture: string,
      mode: 'NodeNext' | 'Bundler',
      nodeOnly: boolean
    ) {
      writeFileSync(join(consumer, 'consumer.mts'), fixture);
      writeFileSync(
        join(consumer, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            target: 'ES2022',
            module: mode === 'NodeNext' ? 'NodeNext' : 'ESNext',
            moduleResolution: mode,
            strict: true,
            skipLibCheck: false,
            noEmitOnError: true,
            lib: nodeOnly ? ['ES2022'] : ['ES2022', 'DOM'],
            types: nodeOnly ? ['node'] : [],
            typeRoots: [nodeTypes],
            outDir: './dist'
          },
          files: ['./consumer.mts']
        })
      );
      return spawnSync(process.execPath, [compiler, '-p', 'tsconfig.json'], {
        cwd: consumer,
        env: childEnvironment,
        encoding: 'utf8',
        timeout: 30_000
      });
    }

    function execute() {
      const runtime = spawnSync(process.execPath, ['dist/consumer.mjs'], {
        cwd: consumer,
        env: childEnvironment,
        timeout: 10_000,
        encoding: 'utf8'
      });
      const diagnostics = runtime.stdout + runtime.stderr;
      expect(runtime.error, diagnostics).toBeUndefined();
      expect(runtime.status, diagnostics).toBe(0);
      expect(diagnostics, diagnostics).toBe('');
    }

    function peerPresence(env: NodeJS.ProcessEnv) {
      return execFileSync(
        process.execPath,
        [
          '--eval',
          `const { createRequire } = require('node:module');
const lookup = createRequire(process.argv[1]);
try {
  lookup.resolve('xstate');
  process.stdout.write('present');
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
  process.stdout.write('absent');
}`,
          join(consumer, 'consumer.mjs')
        ],
        { cwd: consumer, env, encoding: 'utf8', timeout: 10_000 }
      );
    }

    const inheritedPeer = peerPresence(process.env);
    const cleanPeer = peerPresence(childEnvironment);
    expect(cleanPeer).toBe('absent');
    process.stdout.write(
      `Package isolation inherited=${inheritedPeer} clean=${cleanPeer} NODE_PATH entries=${process.env.NODE_PATH?.split(':').length ?? 0}\n`
    );
    for (const mode of ['NodeNext', 'Bundler'] as const) {
      for (const nodeOnly of [true, false]) {
        const positive = compile(source, mode, nodeOnly);
        expect(
          positive.error,
          positive.stdout + positive.stderr
        ).toBeUndefined();
        expect(
          positive.stdout + positive.stderr,
          positive.stdout + positive.stderr
        ).toBe('');
        expect(positive.status, positive.stdout + positive.stderr).toBe(0);
        execute();

        const negative = compile(
          source + "\nsameStore.trigger.add({ by: 'invalid' });\n",
          mode,
          nodeOnly
        );
        expect(
          negative.error,
          negative.stdout + negative.stderr
        ).toBeUndefined();
        expect(negative.status, negative.stdout + negative.stderr).toBe(1);
        expect(
          negative.stdout.match(/error TS\d+:/g),
          negative.stdout + negative.stderr
        ).toEqual(['error TS2322:']);
        expect(negative.stderr, negative.stdout + negative.stderr).toBe('');
      }
    }

    const missingPeer = compile(
      "import { createStore } from '@xstate/store'; void createStore;\n",
      'NodeNext',
      true
    );
    const missingPeerDiagnostics = missingPeer.stdout + missingPeer.stderr;
    expect(missingPeer.error, missingPeerDiagnostics).toBeUndefined();
    expect(missingPeer.status, missingPeerDiagnostics).toBe(1);
    expect(missingPeer.stderr, missingPeerDiagnostics).toBe('');
    expect(
      missingPeer.stdout.match(/error TS\d+:/g),
      missingPeerDiagnostics
    ).toEqual(['error TS2307:']);
    expect(missingPeer.stdout, missingPeerDiagnostics).toContain(
      "Cannot find module 'xstate' or its corresponding type declarations."
    );

    copyPackage(
      resolve(packageRoot, '../core'),
      join(root, 'node_modules/xstate')
    );
    expect(peerPresence(childEnvironment)).toBe('present');
    const identity = readFileSync(
      join(packageRoot, 'test/package/identity.mts.txt'),
      'utf8'
    );
    for (const mode of ['NodeNext', 'Bundler'] as const) {
      const peer = compile(identity, mode, true);
      expect(peer.error, peer.stdout + peer.stderr).toBeUndefined();
      expect(peer.stdout + peer.stderr, peer.stdout + peer.stderr).toBe('');
      expect(peer.status, peer.stdout + peer.stderr).toBe(0);
      execute();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 180_000);
