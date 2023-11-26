'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { getPackagesSync } = require('@manypkg/get-packages');

const gitStatusResult = spawnSync('git', ['status', '--porcelain']);

if (gitStatusResult.status !== 0) {
  process.exit(gitStatusResult.status);
}

const rootDir = path.join(__dirname, '..');

const allPackages = getPackagesSync(rootDir).packages;

const pkgChanges = new Map(
  gitStatusResult.stdout
    .toString()
    .trim()
    .split('\n')
    .filter((line) => /^\s*M\s+.*\/package.json/.test(line))
    .map((line) => {
      const gitPath = line.match(/[^\s]+package.json/)[0];
      const fsPath = path.join(rootDir, gitPath);
      const packageJson = require(fsPath);
      const previousPackageJsonResult = spawnSync('git', [
        'show',
        `HEAD:${gitPath}`
      ]);

      if (previousPackageJsonResult.status !== 0) {
        process.exit(gitStatusResult.status);
      }

      return [
        packageJson.name,
        {
          path: fsPath,
          packageJson: packageJson,
          versionChanged:
            packageJson.version !==
            JSON.parse(previousPackageJsonResult.stdout.toString().trim())
              .version
        }
      ];
    })
);

for (const peerPkg of ['xstate']) {
  const peerPkgChange = pkgChanges.get(peerPkg);
  if (!peerPkgChange || !peerPkgChange.versionChanged) {
    continue;
  }
  for (const dependentPkg of allPackages) {
    const peerDeps = dependentPkg.packageJson.peerDependencies;
    if (!peerDeps || !peerDeps[peerPkg]) {
      continue;
    }
    const pkgJsonCopy = { ...dependentPkg.packageJson };
    pkgJsonCopy.peerDependencies[peerPkg] =
      `^${peerPkgChange.packageJson.version}`;
    fs.writeFileSync(
      path.join(dependentPkg.dir, 'package.json'),
      JSON.stringify(pkgJsonCopy, null, 2) + '\n'
    );
  }
}
