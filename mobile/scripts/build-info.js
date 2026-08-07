const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const wwwDir = path.resolve(__dirname, '../www');
const packageJsonPath = path.resolve(__dirname, '../package.json');
const buildInfoPath = path.join(wwwDir, 'build-info.json');

console.log('[Build Info] Generating build metadata...');

let version = '1.0.0';
if (fs.existsSync(packageJsonPath)) {
  try {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    if (pkg.version) version = pkg.version;
  } catch (err) {
    console.warn('[Build Info] Warning: Could not read package.json version:', err.message);
  }
}

let gitCommit = 'unknown';
try {
  gitCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
} catch (err) {
  console.warn('[Build Info] Warning: Could not retrieve git commit hash.');
}

const buildInfo = {
  version: version,
  build: Math.floor(Date.now() / 1000),
  git_commit: gitCommit,
  built_at: new Date().toISOString(),
  environment: process.env.NODE_ENV || 'production'
};

if (!fs.existsSync(wwwDir)) {
  fs.mkdirSync(wwwDir, { recursive: true });
}

fs.writeFileSync(buildInfoPath, JSON.stringify(buildInfo, null, 2), 'utf8');
console.log(`[Build Info] Wrote build metadata to ${buildInfoPath}:`, JSON.stringify(buildInfo));
