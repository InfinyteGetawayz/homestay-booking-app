const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Building frontend...');
try {
  execSync('npm run build', { cwd: path.join(__dirname, 'frontend'), stdio: 'inherit' });
} catch (err) {
  console.error('Failed to build frontend:', err.message);
  process.exit(1);
}

const srcDir = path.join(__dirname, 'frontend', 'dist');
const destDir = path.join(__dirname, 'backend', 'public');

// Helper to recursively copy directories
function copyFolderSync(from, to) {
  if (!fs.existsSync(to)) {
    fs.mkdirSync(to, { recursive: true });
  }
  fs.readdirSync(from).forEach(element => {
    const srcPath = path.join(from, element);
    const destPath = path.join(to, element);
    const stat = fs.lstatSync(srcPath);
    if (stat.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    } else if (stat.isDirectory()) {
      copyFolderSync(srcPath, destPath);
    }
  });
}

console.log('Cleaning destination...');
if (fs.existsSync(destDir)) {
  fs.rmSync(destDir, { recursive: true, force: true });
}

console.log('Copying build to backend public folder...');
if (fs.existsSync(srcDir)) {
  copyFolderSync(srcDir, destDir);
  console.log('Build completed successfully!');
} else {
  console.error('Frontend build folder not found at:', srcDir);
  process.exit(1);
}
