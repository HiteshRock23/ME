const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../..');
const staticDir = path.join(projectRoot, 'static');
const wwwDir = path.resolve(__dirname, '../www');
const wwwStaticDir = path.join(wwwDir, 'static');

/**
 * Recursive File/Directory Copy Helper
 */
function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
  }
}

console.log('[Package Web] Preparing web bundle for Capacitor Android...');

if (!fs.existsSync(staticDir)) {
  console.error(`[Package Web] ERROR: Static directory not found at ${staticDir}`);
  process.exit(1);
}

// 1. Ensure www directory exists
if (!fs.existsSync(wwwDir)) {
  fs.mkdirSync(wwwDir, { recursive: true });
}

// 2. Copy index.html to www root (WebView entry point)
const indexHtmlSrc = path.join(staticDir, 'index.html');
const indexHtmlDest = path.join(wwwDir, 'index.html');

if (fs.existsSync(indexHtmlSrc)) {
  fs.copyFileSync(indexHtmlSrc, indexHtmlDest);
  console.log(`[Package Web] Copied index.html -> ${indexHtmlDest}`);
} else {
  console.error(`[Package Web] ERROR: index.html not found at ${indexHtmlSrc}`);
  process.exit(1);
}

// 3. Mirror static/ into www/static/ so /static/... asset URLs resolve natively
console.log(`[Package Web] Copying static assets from ${staticDir} to ${wwwStaticDir}...`);
copyRecursiveSync(staticDir, wwwStaticDir);

console.log('[Package Web] Packaging complete! Web bundle structure ready in mobile/www/.');
