const fs = require('fs');
const path = require('path');

const wwwDir = path.resolve(__dirname, '../www');
const androidAssetsPublicDir = path.resolve(__dirname, '../android/app/src/main/assets/public');

/**
 * Validates target packaged asset directory structure
 */
function validateAssetStructure(baseDir, label) {
  console.log(`[Verify Assets] Validating ${label} at ${baseDir}...`);

  if (!fs.existsSync(baseDir)) {
    console.error(`[Verify Assets] FAIL: Directory does not exist: ${baseDir}`);
    return false;
  }

  const indexHtml = path.join(baseDir, 'index.html');
  if (!fs.existsSync(indexHtml)) {
    console.error(`[Verify Assets] FAIL: Missing entrypoint index.html in ${baseDir}`);
    return false;
  }

  const buildInfo = path.join(baseDir, 'build-info.json');
  if (!fs.existsSync(buildInfo)) {
    console.error(`[Verify Assets] FAIL: Missing build-info.json in ${baseDir}`);
    return false;
  }

  const staticDir = path.join(baseDir, 'static');
  if (!fs.existsSync(staticDir) || !fs.statSync(staticDir).isDirectory()) {
    console.error(`[Verify Assets] FAIL: Missing static/ directory in ${baseDir}`);
    return false;
  }

  const requiredStaticItems = [
    { relativePath: 'css', isDir: true },
    { relativePath: 'js', isDir: true },
    { relativePath: 'js/environment.js', isDir: false },
    { relativePath: 'js/network.js', isDir: false },
    { relativePath: 'js/startup.js', isDir: false },
    { relativePath: 'js/native.js', isDir: false },
    { relativePath: 'js/loading.js', isDir: false },
    { relativePath: 'js/toast.js', isDir: false },
    { relativePath: 'js/lifecycle.js', isDir: false },
    { relativePath: 'js/api.js', isDir: false },
    { relativePath: 'js/auth.js', isDir: false },
    { relativePath: 'icons', isDir: true },
    { relativePath: 'manifest.json', isDir: false },
    { relativePath: 'sw.js', isDir: false }
  ];

  let allPassed = true;
  for (const item of requiredStaticItems) {
    const itemPath = path.join(staticDir, item.relativePath);
    if (!fs.existsSync(itemPath)) {
      console.error(`[Verify Assets] FAIL: Missing required asset ${staticDir}/${item.relativePath}`);
      allPassed = false;
      continue;
    }

    const stats = fs.statSync(itemPath);
    if (item.isDir && !stats.isDirectory()) {
      console.error(`[Verify Assets] FAIL: Expected directory but found file at ${itemPath}`);
      allPassed = false;
    } else if (!item.isDir && !stats.isFile()) {
      console.error(`[Verify Assets] FAIL: Expected file but found directory at ${itemPath}`);
      allPassed = false;
    }
  }

  if (allPassed) {
    console.log(`[Verify Assets] PASS: ${label} asset structure validated successfully.`);
  }

  return allPassed;
}

const checkAndroidPublic = process.argv.includes('--android');

let success = validateAssetStructure(wwwDir, 'Web Bundle (www)');

if (checkAndroidPublic) {
  const androidSuccess = validateAssetStructure(androidAssetsPublicDir, 'Android Assets (public)');
  success = success && androidSuccess;
}

if (!success) {
  console.error('[Verify Assets] BUILD FAILED: Asset structure validation failed.');
  process.exit(1);
}

console.log('[Verify Assets] Asset validation completed with 0 errors.');
