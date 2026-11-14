#!/usr/bin/env node
// Angular compatibility smoke test: installs the packed library into a real
// consumer app pinned to one Angular major, builds it, serves the output and
// runs compat/smoke.spec.ts against it with Playwright.
//
//   npm run compat -- <ng18|ng20|ng22> [--rebuild | --no-build]
//
// The library in dist/ is rebuilt when missing or older than its sources
// (--rebuild forces it; --no-build uses dist/ as is, e.g. a CI artifact).
// Needs Chromium for Playwright once: `npx playwright install chromium` in compat/.
// ng22 needs the Node versions the Angular 22 CLI accepts (^22.22.3 || ^24.15.0 || >=26).
import { spawn, spawnSync } from 'node:child_process';
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const APPS = ['ng18', 'ng20', 'ng22'];
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const compatDir = join(root, 'compat');
const libSrc = join(root, 'projects', 'assistant-ui-angular');
const libDist = join(root, 'dist', 'assistant-ui-angular');
const packDir = join(compatDir, '.packs');

const args = process.argv.slice(2);
const app = args.find((arg) => !arg.startsWith('-'));
const rebuild = args.includes('--rebuild');
const noBuild = args.includes('--no-build');
if (!app || !APPS.includes(app)) {
  console.error(`usage: npm run compat -- <${APPS.join('|')}> [--rebuild | --no-build]`);
  process.exit(2);
}
const appDir = join(compatDir, app);

const log = (message) => console.log(`\n[compat:${app}] ${message}`);

/** Runs a command, inheriting stdio; exits the script when it fails. */
function run(command, commandArgs, cwd, env = {}) {
  console.log(`$ ${[command, ...commandArgs].join(' ')}   (in ${cwd})`);
  const result = spawnSync(command, commandArgs, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function must(status, what) {
  if (status !== 0) {
    console.error(`\n[compat:${app}] FAIL: ${what} exited with ${status}`);
    process.exit(status || 1);
  }
}

// npm is a .cmd shim on Windows; run its JS entry with this Node instead of a shell.
const npmCli = process.env.npm_execpath?.endsWith('.js')
  ? process.env.npm_execpath
  : join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
if (!existsSync(npmCli)) {
  console.error(`cannot find npm-cli.js (looked at ${npmCli}); run via \`npm run compat\`.`);
  process.exit(2);
}
const npm = (npmArgs, cwd) => run(process.execPath, [npmCli, ...npmArgs], cwd);

/** Newest mtime (ms) of any file under dir, skipping node_modules. */
function newestMtime(dir) {
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const path = join(dir, entry.name);
    newest = Math.max(newest, entry.isDirectory() ? newestMtime(path) : statSync(path).mtimeMs);
  }
  return newest;
}

/** Installs a package's lockfile dependencies when node_modules is missing or stale. */
function ensureInstalled(dir) {
  const lock = join(dir, 'package-lock.json');
  const installed = join(dir, 'node_modules', '.package-lock.json');
  if (existsSync(installed) && statSync(installed).mtimeMs >= statSync(lock).mtimeMs) return;
  must(npm(['ci', '--no-audit', '--no-fund'], dir), `npm ci in ${dir}`);
}

// 1. Library build (reused when dist is newer than every library source file).
const distManifest = join(libDist, 'package.json');
if (noBuild) {
  if (!existsSync(distManifest)) {
    console.error(`--no-build given but ${libDist} does not exist`);
    process.exit(1);
  }
  log('using dist/assistant-ui-angular as is (--no-build)');
} else if (
  rebuild ||
  !existsSync(distManifest) ||
  statSync(distManifest).mtimeMs < newestMtime(libSrc)
) {
  log('building the library');
  must(npm(['run', 'build:lib'], root), 'npm run build:lib');
} else {
  log('reusing fresh dist/assistant-ui-angular (pass --rebuild to force)');
}

// 2. Pack it exactly as it would be published.
log('packing the library');
rmSync(packDir, { recursive: true, force: true });
mkdirSync(packDir, { recursive: true });
must(npm(['pack', '--loglevel=warn', libDist, '--pack-destination', packDir], root), 'npm pack');
const tarball = readdirSync(packDir).find((name) => name.endsWith('.tgz'));
if (!tarball) {
  console.error('npm pack produced no tarball');
  process.exit(1);
}

// 3. Install the app's locked dependencies, then the tarball (without
//    touching its package.json or lockfile).
log('installing dependencies and the packed library');
ensureInstalled(appDir);
must(
  npm(['install', '--no-save', '--no-audit', '--no-fund', join(packDir, tarball)], appDir),
  'npm install <tarball>',
);
for (const name of [
  '@angular/core',
  '@angular/cli',
  'typescript',
  'zone.js',
  'angular-assistant-ui',
]) {
  const manifest = join(appDir, 'node_modules', ...name.split('/'), 'package.json');
  const version = existsSync(manifest)
    ? JSON.parse(readFileSync(manifest, 'utf8')).version
    : '(not installed)';
  console.log(`  ${name}@${version}`);
}

// 4. Production build of the consumer app.
log('building the app');
rmSync(join(appDir, 'dist'), { recursive: true, force: true });
const ngCli = join(appDir, 'node_modules', '@angular', 'cli', 'bin', 'ng.js');
must(run(process.execPath, [ngCli, 'build'], appDir, { NG_CLI_ANALYTICS: 'false' }), 'ng build');
const browserDir = join(appDir, 'dist', app, 'browser');
if (!existsSync(join(browserDir, 'index.html'))) {
  console.error(`no index.html in ${browserDir}`);
  process.exit(1);
}

// 5. Serve the build statically (SPA fallback to index.html).
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};
const server = createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
  let file = resolve(browserDir, `.${pathname}`);
  if (file !== browserDir && !file.startsWith(browserDir + sep)) {
    res.writeHead(403).end();
    return;
  }
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(browserDir, 'index.html');
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((ready) => server.listen(0, '127.0.0.1', ready));
const baseUrl = `http://127.0.0.1:${server.address().port}`;
log(`serving ${browserDir} at ${baseUrl}`);

// 6. Playwright smoke test. Run async so this process keeps serving requests.
let status = 1;
try {
  ensureInstalled(compatDir);
  log('running the Playwright smoke test');
  const playwrightCli = join(compatDir, 'node_modules', '@playwright', 'test', 'cli.js');
  status = await new Promise((done, fail) => {
    const child = spawn(
      process.execPath,
      [playwrightCli, 'test', '--config', 'playwright.config.ts'],
      {
        cwd: compatDir,
        stdio: 'inherit',
        env: { ...process.env, COMPAT_BASE_URL: baseUrl, COMPAT_APP: app },
      },
    );
    child.on('error', fail);
    child.on('exit', (code) => done(code ?? 1));
  });
} finally {
  server.close();
}

log(status === 0 ? 'PASS' : `FAIL (playwright exited with ${status})`);
process.exit(status);
