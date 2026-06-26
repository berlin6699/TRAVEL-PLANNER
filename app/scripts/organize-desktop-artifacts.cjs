const fs = require('node:fs');
const path = require('node:path');

const appRoot = path.resolve(__dirname, '..');
const pkg = require(path.join(appRoot, 'package.json'));
const distDir = path.join(appRoot, 'desktop-dist');
const archiveRoot = path.join(distDir, 'archive');
const latestDir = path.join(distDir, 'latest');
const unpackedDir = path.join(distDir, 'unpacked');
const diagnosticsDir = path.join(distDir, 'diagnostics');
const today = new Date().toISOString().slice(0, 10);
const archiveDir = path.join(archiveRoot, `${today}-before-v${pkg.version}`);

const artifactPattern = /\.(dmg|zip|exe|apk|blockmap)$/i;
const unpackedDirPattern = /^(mac|mac-arm64|mac-universal|win-unpacked|linux-unpacked)$/i;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function uniquePath(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return targetPath;
  }

  const parsed = path.parse(targetPath);
  let index = 2;
  let nextPath = path.join(parsed.dir, `${parsed.name}-${index}${parsed.ext}`);

  while (fs.existsSync(nextPath)) {
    index += 1;
    nextPath = path.join(parsed.dir, `${parsed.name}-${index}${parsed.ext}`);
  }

  return nextPath;
}

if (!fs.existsSync(distDir)) {
  console.log(`No desktop-dist directory found: ${distDir}`);
  process.exit(0);
}

ensureDir(archiveDir);
ensureDir(latestDir);
ensureDir(unpackedDir);
ensureDir(diagnosticsDir);

const moved = [];

for (const entry of fs.readdirSync(distDir, { withFileTypes: true })) {
  if (
    entry.name === 'archive' ||
    entry.name === 'latest' ||
    entry.name === 'unpacked' ||
    entry.name === 'diagnostics' ||
    entry.name.startsWith('.')
  ) {
    continue;
  }

  if (entry.isDirectory() && unpackedDirPattern.test(entry.name)) {
    const from = path.join(distDir, entry.name);
    const to = uniquePath(path.join(unpackedDir, entry.name));
    fs.renameSync(from, to);
    moved.push(`${entry.name}/ → unpacked/`);
    continue;
  }

  if (entry.isFile() && entry.name === 'builder-debug.yml') {
    const from = path.join(distDir, entry.name);
    const to = uniquePath(path.join(diagnosticsDir, entry.name));
    fs.renameSync(from, to);
    moved.push(`${entry.name} → diagnostics/`);
    continue;
  }

  if (!entry.isFile() || !artifactPattern.test(entry.name)) {
    continue;
  }

  const from = path.join(distDir, entry.name);

  if (entry.name.includes(pkg.version)) {
    const to = uniquePath(path.join(latestDir, entry.name));
    fs.renameSync(from, to);
    moved.push(`${entry.name} → latest/`);
    continue;
  }

  const to = uniquePath(path.join(archiveDir, entry.name));
  fs.renameSync(from, to);
  moved.push(`${entry.name} → archive/`);
}

if (moved.length === 0) {
  console.log(`desktop-dist is already tidy for version ${pkg.version}.`);
  process.exit(0);
}

console.log(`Organized ${moved.length} desktop artifact(s).`);
for (const name of moved) {
  console.log(`- ${name}`);
}
