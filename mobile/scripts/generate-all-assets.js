const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

async function run() {
  try {
    console.log('================================================================');
    console.log('🚀 Starting App Icon Asset Generation Wrapper...');
    console.log('================================================================\n');

    const isWindows = process.platform === 'win32';
    const psScriptPath = path.resolve(__dirname, 'generate-all-assets.ps1');

    if (isWindows && fs.existsSync(psScriptPath)) {
      console.log('💻 Windows detected. Running native high-performance PowerShell asset pipeline...');
      execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psScriptPath}"`, { stdio: 'inherit' });
    } else {
      console.log('🍎/🐧 Non-Windows platform or script missing. Falling back to JS-based Jimp resizer (unsupported in this specific environment)...');
      console.error('Error: Native PowerShell script is required for high-performance transparent safe-zone padding on this workspace.');
      process.exit(1);
    }
  } catch (err) {
    console.error('\n❌ ERROR generating assets:', err);
    process.exit(1);
  }
}

run();
