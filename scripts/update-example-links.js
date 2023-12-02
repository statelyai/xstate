// @ts-check
// Use the fs module to get a list of all files in the /examples directory recursively.
const fs = require('fs');
const path = require('path');
const examplesDir = path.resolve(__dirname, '..', 'examples');
const files = fs.readdirSync(examplesDir, { withFileTypes: true });
const exampleDirs = files
  .filter((f) => f.isDirectory())
  .map((f) => f.name)
  .filter((n) => !n.startsWith('.'));

// For each readme.md file:
exampleDirs.forEach((x) => {
  const exampleDir = path.join(examplesDir, x);
  console.log(exampleDir);
  // readme.md or README.md
  let readmeFile = path.join(exampleDir, 'README.md');
  if (!fs.existsSync(readmeFile)) {
    readmeFile = path.join(exampleDir, 'readme.md');
  }
  if (!fs.existsSync(readmeFile)) {
    console.log(`Skipping ${exampleDir} (no ${readmeFile})`);
    return;
  }

  // Read the file contents with fs.readFileSync
  const readmeContents = fs.readFileSync(readmeFile, 'utf8');

  // If it already has a stackblitz link, skip
  if (readmeContents.includes('stackblitz.com/github')) {
    console.log(`Skipping ${exampleDir} (already has Stackblitz link)`);
    return;
  }

  // Check if the file contains the <!-- stackblitz --> comment
  const stackblitzComment = readmeContents.indexOf('<!-- stackblitz -->');

  if (stackblitzComment === -1) {
    console.log(`Skipping ${exampleDir} (no <!-- stackblitz --> comment)`);
    return;
  }

  // Insert the Stackblitz link right after the comment, which should look like:
  // [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/statelyai/xstate/tree/main/examples/${dirName})

  const stackblitzLink = `[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/statelyai/xstate/tree/main/examples/${exampleDir})`;

  // Replace the stackblitz comment with a link
  const updatedReadmeContents = readmeContents.replace(
    '<!-- stackblitz -->',
    stackblitzLink
  );

  console.log(updatedReadmeContents, readmeFile);

  // Write the updated contents back to the file
  fs.writeFileSync(readmeFile, updatedReadmeContents);
});
