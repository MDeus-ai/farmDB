#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

function printHelp() {
  console.log(`farmDB Version Bump & Release Helper

Usage:
  node scripts/release-bump.mjs [X.Y.Z | --patch | --minor | --major] [options]

Options:
  --patch             Bump patch version (default)
  --minor             Bump minor version (resets patch to 0)
  --major             Bump major version (resets minor & patch to 0)
  --notes "<text>"    Add a release note / changelog bullet (repeatable)
  --message "<text>"  Commit summary text (used with --ship)
  --ship              Bump, run verification, commit, tag farmDB-vX.Y.Z, and push
  --skip-checks       Skip sync:avators, test, typecheck, and build:desktop on --ship
  --dry-run           Print planned changes without writing files or running git
  --help, -h          Show this help text

Examples:
  npm run version:bump
  npm run version:bump -- --notes "Fixed desktop close button"
  npm run release:ship -- --message "desktop close fix" --notes "Fixed desktop close button"
`);
}

function parseArgs(argv) {
  let bumpKind = 'patch';
  let explicitVersion = null;
  let summary = '';
  let ship = false;
  let skipChecks = false;
  let dryRun = false;
  const notes = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (arg === '--patch') {
      bumpKind = 'patch';
    } else if (arg === '--minor') {
      bumpKind = 'minor';
    } else if (arg === '--major') {
      bumpKind = 'major';
    } else if (arg === '--ship') {
      ship = true;
    } else if (arg === '--skip-checks') {
      skipChecks = true;
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--notes' || arg === '-n') {
      const next = argv[i + 1];
      if (!next) throw new Error(`${arg} requires a text argument.`);
      notes.push(next.trim());
      i++;
    } else if (arg.startsWith('--notes=')) {
      notes.push(arg.slice('--notes='.length).trim());
    } else if (arg === '--message' || arg === '-m') {
      const next = argv[i + 1];
      if (!next) throw new Error(`${arg} requires a summary message.`);
      summary = next.trim();
      i++;
    } else if (arg.startsWith('--message=')) {
      summary = arg.slice('--message='.length).trim();
    } else if (/^\d+\.\d+\.\d+$/.test(arg) && !explicitVersion) {
      explicitVersion = arg;
    } else if (!arg.startsWith('-')) {
      summary = summary ? `${summary} ${arg}` : arg;
    } else {
      throw new Error(`Unknown flag: ${arg}`);
    }
  }

  return {
    bumpKind,
    explicitVersion,
    notes: notes.filter(Boolean),
    summary: summary.trim(),
    ship,
    skipChecks,
    dryRun,
  };
}

function readText(relPath) {
  return fs.readFileSync(path.join(ROOT_DIR, relPath), 'utf8');
}

function writeText(relPath, content, dryRun) {
  if (!dryRun) {
    fs.writeFileSync(path.join(ROOT_DIR, relPath), content, 'utf8');
  }
}

function computeNextVersion(currentVersion, bumpKind, explicitVersion) {
  if (explicitVersion) {
    if (!/^\d+\.\d+\.\d+$/.test(explicitVersion)) {
      throw new Error(`Invalid explicit semver: "${explicitVersion}"`);
    }
    return explicitVersion;
  }

  const m = currentVersion.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) {
    throw new Error(`Current package.json version is invalid: "${currentVersion}"`);
  }
  let major = Number(m[1]);
  let minor = Number(m[2]);
  let patch = Number(m[3]);

  if (bumpKind === 'major') {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (bumpKind === 'minor') {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }
  return `${major}.${minor}.${patch}`;
}

function formatTodayLocalIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function escapeTsSingleQuoted(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r?\n+/g, ' ')
    .trim();
}

function getRecentCommitSubjectsSinceLastTag() {
  try {
    const latestTag = execFileSync(
      'git',
      ['describe', '--tags', '--abbrev=0'],
      { cwd: ROOT_DIR, encoding: 'utf8' }
    ).trim();
    const range = latestTag ? `${latestTag}..HEAD` : 'HEAD~10..HEAD';
    const raw = execFileSync(
      'git',
      ['log', range, '--pretty=format:%s', '--no-merges', '-n', '10'],
      { cwd: ROOT_DIR, encoding: 'utf8' }
    );
    return raw
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s && !/^release\(v\d+\.\d+\.\d+\)/i.test(s));
  } catch {
    return [];
  }
}

function tagExists(tagName) {
  try {
    const out = execFileSync('git', ['tag', '--list', tagName], {
      cwd: ROOT_DIR,
      encoding: 'utf8',
    }).trim();
    return out === tagName;
  } catch {
    return false;
  }
}

function runCommand(cmd, args) {
  const actualCmd =
    process.platform === 'win32' && (cmd === 'npm' || cmd === 'npx')
      ? `${cmd}.cmd`
      : cmd;
  const res = spawnSync(actualCmd, args, {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    shell: process.platform === 'win32' && actualCmd.endsWith('.cmd'),
  });
  if (res.error) throw res.error;
  if (res.status !== 0) {
    throw new Error(`Command failed (${cmd} ${args.join(' ')}) with exit code ${res.status}`);
  }
}

function updateJsonTopVersion(relPath, nextVersion, dryRun) {
  const src = readText(relPath);
  const re = /("version"\s*:\s*")([^"]+)(")/;
  if (!re.test(src)) {
    throw new Error(`Could not find top-level "version" field in ${relPath}`);
  }
  const updated = src.replace(re, `$1${nextVersion}$3`);
  writeText(relPath, updated, dryRun);
  return updated !== src;
}

function updatePackageLockVersion(nextVersion, dryRun) {
  const relPath = 'package-lock.json';
  const src = readText(relPath);
  const marker = '    "node_modules/';
  const splitIdx = src.indexOf(marker);
  const head = splitIdx === -1 ? src.slice(0, 1200) : src.slice(0, splitIdx);
  const tail = splitIdx === -1 ? src.slice(1200) : src.slice(splitIdx);

  let updatedHead = head.replace(
    /(\{\r?\n\s*"name"\s*:\s*"farmdb-monorepo",\r?\n\s*"version"\s*:\s*")([^"]+)(")/,
    `$1${nextVersion}$3`
  );
  updatedHead = updatedHead.replace(
    /(""\s*:\s*\{\r?\n\s*"name"\s*:\s*"farmdb-monorepo",\r?\n\s*"version"\s*:\s*")([^"]+)(")/,
    `$1${nextVersion}$3`
  );
  updatedHead = updatedHead.replace(
    /("apps\/desktop"\s*:\s*\{\r?\n\s*"name"\s*:\s*"@farmdb\/desktop",\r?\n\s*"version"\s*:\s*")([^"]+)(")/,
    `$1${nextVersion}$3`
  );

  const updated = updatedHead + tail;
  writeText(relPath, updated, dryRun);
  return updated !== src;
}

function updateCargoTomlVersion(nextVersion, dryRun) {
  const relPath = 'apps/desktop/src-tauri/Cargo.toml';
  const src = readText(relPath);
  const re = /(\[package\][\s\S]*?\r?\nversion\s*=\s*")([^"]+)(")/;
  if (!re.test(src)) {
    throw new Error(`Could not find [package] version in ${relPath}`);
  }
  const updated = src.replace(re, `$1${nextVersion}$3`);
  writeText(relPath, updated, dryRun);
  return updated !== src;
}

function updateCargoLockVersion(nextVersion, dryRun) {
  const relPath = 'apps/desktop/src-tauri/Cargo.lock';
  const src = readText(relPath);
  const re = /(name\s*=\s*"farmdb-desktop"\r?\nversion\s*=\s*")([^"]+)(")/;
  if (!re.test(src)) {
    throw new Error(`Could not find farmdb-desktop package version in ${relPath}`);
  }
  const updated = src.replace(re, `$1${nextVersion}$3`);
  writeText(relPath, updated, dryRun);
  return updated !== src;
}

function updateTauriConfVersion(nextVersion, dryRun) {
  const relPath = 'apps/desktop/src-tauri/tauri.conf.json';
  const src = readText(relPath);
  const re = /("productName"\s*:\s*"farmDB",\r?\n\s*"version"\s*:\s*")([^"]+)(")/;
  if (!re.test(src)) {
    throw new Error(`Could not find "version" in ${relPath}`);
  }
  const updated = src.replace(re, `$1${nextVersion}$3`);
  writeText(relPath, updated, dryRun);
  return updated !== src;
}

function updateUpdatesTs(nextVersion, notes, dryRun) {
  const relPath = 'packages/core/src/updates.ts';
  const src = readText(relPath);
  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  let updated = src.replace(
    /(export const FARMDB_APP_VERSION = ')([^']+)(';)/,
    `$1${nextVersion}$3`
  );

  if (notes.length > 0) {
    const highlightsRe =
      /(export const CURRENT_RELEASE_HIGHLIGHTS: readonly string\[\] = \[)([\s\S]*?)(\];)/;
    const match = updated.match(highlightsRe);
    if (match) {
      const existingItems = [];
      const itemRe = /'((?:\\.|[^'\\])*)'/g;
      let m;
      while ((m = itemRe.exec(match[2])) !== null) {
        existingItems.push(m[1]);
      }
      const nextItems = [
        ...notes.map(escapeTsSingleQuoted),
        ...existingItems.filter(
          (item) =>
            !notes.some(
              (n) => escapeTsSingleQuoted(n).toLowerCase() === item.toLowerCase()
            )
        ),
      ].slice(0, 6);
      const rendered = nextItems.map((item) => `  '${item}',`).join(eol);
      updated = updated.replace(
        highlightsRe,
        `$1${eol}${rendered}${eol}$3`
      );
    }
  }

  writeText(relPath, updated, dryRun);
  return updated !== src;
}

function updateReadme(nextVersion, dryRun) {
  const relPath = 'README.md';
  const src = readText(relPath);
  let updated = src.replace(
    /^(# farmDB \(v)(\d+\.\d+\.\d+)(\))/m,
    `$1${nextVersion}$3`
  );
  updated = updated.replace(
    /(farmDB_)(\d+\.\d+\.\d+)(_x64-setup\.exe)/g,
    `$1${nextVersion}$3`
  );
  updated = updated.replace(
    /(farmDB_)(\d+\.\d+\.\d+)(_x64_en-US\.msi)/g,
    `$1${nextVersion}$3`
  );
  writeText(relPath, updated, dryRun);
  return updated !== src;
}

function updateChangelog(nextVersion, notes, summary, dryRun) {
  const relPath = 'CHANGELOG.md';
  const src = readText(relPath);
  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  const versionHeadingRe = new RegExp(
    `^\\s*##\\s+\\[?v?${nextVersion.replace(/\./g, '\\.')}\\]?\\b`,
    'm'
  );
  if (versionHeadingRe.test(src)) {
    return false;
  }

  const bullets =
    notes.length > 0
      ? notes
      : getRecentCommitSubjectsSinceLastTag();
  const resolvedBullets =
    bullets.length > 0
      ? bullets
      : [
          summary ||
            `Maintenance release v${nextVersion} across Desktop and Mobile.`,
        ];
  const leadSummary =
    summary ||
    resolvedBullets[0].replace(/\.$/, '') + '.';

  const section = [
    `## [${nextVersion}] - ${formatTodayLocalIso()}`,
    '',
    leadSummary,
    '',
    '### Fixes & Improvements',
    ...resolvedBullets.map((line) => `- ${line}`),
    '',
  ].join(eol);

  const firstReleaseIdx = src.search(/^##\s+\[/m);
  let updated;
  if (firstReleaseIdx !== -1) {
    updated =
      src.slice(0, firstReleaseIdx) + section + eol + src.slice(firstReleaseIdx);
  } else {
    updated = `${src.trimEnd()}${eol}${eol}${section}`;
  }

  writeText(relPath, updated, dryRun);
  return updated !== src;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const rootPkg = JSON.parse(readText('package.json'));
  const currentVersion = rootPkg.version;
  const nextVersion = computeNextVersion(
    currentVersion,
    opts.bumpKind,
    opts.explicitVersion
  );
  const tagName = `farmDB-v${nextVersion}`;

  if (opts.ship && tagExists(tagName)) {
    throw new Error(`Git tag "${tagName}" already exists locally.`);
  }

  const touched = [
    ['package.json', updateJsonTopVersion('package.json', nextVersion, opts.dryRun)],
    ['package-lock.json', updatePackageLockVersion(nextVersion, opts.dryRun)],
    ['apps/desktop/package.json', updateJsonTopVersion('apps/desktop/package.json', nextVersion, opts.dryRun)],
    ['apps/desktop/src-tauri/Cargo.toml', updateCargoTomlVersion(nextVersion, opts.dryRun)],
    ['apps/desktop/src-tauri/Cargo.lock', updateCargoLockVersion(nextVersion, opts.dryRun)],
    ['apps/desktop/src-tauri/tauri.conf.json', updateTauriConfVersion(nextVersion, opts.dryRun)],
    ['packages/core/src/updates.ts', updateUpdatesTs(nextVersion, opts.notes, opts.dryRun)],
    ['README.md', updateReadme(nextVersion, opts.dryRun)],
    ['CHANGELOG.md', updateChangelog(nextVersion, opts.notes, opts.summary, opts.dryRun)],
  ];

  console.log(
    `${opts.dryRun ? '[dry-run] ' : ''}Version bump: ${currentVersion} -> ${nextVersion} (tag: ${tagName})`
  );
  for (const [file, changed] of touched) {
    console.log(`  ${changed ? 'updated' : 'unchanged'}: ${file}`);
  }
  console.log(
    '  preserved: apps/mobile/app.json ("1.5.0" kept for Expo EAS OTA runtimeVersion compatibility)'
  );

  if (!opts.ship) {
    const commitMsg = opts.summary
      ? `release(v${nextVersion}): ${opts.summary}`
      : `release(v${nextVersion}): maintenance & bug-fix release`;
    console.log(`\nNext commands to commit & trigger CI build:\n`);
    console.log(`git add -A`);
    console.log(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`);
    console.log(`git tag ${tagName}`);
    console.log(`git push origin master ${tagName}`);
    return;
  }

  if (opts.dryRun) {
    console.log('\n[dry-run] Skipping verification, commit, tag, and push.');
    return;
  }

  if (!opts.skipChecks) {
    runCommand('node', ['scripts/sync-avators.mjs']);
    runCommand('npm', ['test']);
    runCommand('npm', ['run', 'typecheck']);
    runCommand('npm', ['run', 'build:desktop']);
  }

  const commitSummary =
    opts.summary ||
    (opts.notes[0]
      ? opts.notes[0].replace(/\.$/, '').slice(0, 72)
      : 'fixes & improvements');
  const commitMsg = `release(v${nextVersion}): ${commitSummary}`;

  runCommand('git', ['add', '-A']);
  runCommand('git', ['commit', '-m', commitMsg]);
  runCommand('git', ['tag', tagName]);
  runCommand('git', ['push', 'origin', 'master', tagName]);

  console.log(
    `\nReleased ${tagName}! Monitor builds at https://github.com/MDeus-ai/farmDB/actions`
  );
}

main();
