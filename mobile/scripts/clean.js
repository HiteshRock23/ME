const fs = require('fs');
const path = require('path');

const wwwDir = path.resolve(__dirname, '../www');
const androidAssetsPublicDir = path.resolve(__dirname, '../android/app/src/main/assets/public');

console.log('[Clean] Cleaning build artifacts...');

if (fs.existsSync(wwwDir)) {
  fs.rmSync(wwwDir, { recursive: true, force: true });
  console.log(`[Clean] Removed ${wwwDir}`);
}

if (fs.existsSync(androidAssetsPublicDir)) {
  fs.rmSync(androidAssetsPublicDir, { recursive: true, force: true });
  console.log(`[Clean] Removed ${androidAssetsPublicDir}`);
}

console.log('[Clean] Clean completed successfully.');
