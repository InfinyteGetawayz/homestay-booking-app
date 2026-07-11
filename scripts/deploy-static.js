#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const base = process.env.VITE_BASE || '/bookingapp/';
const repoRoot = process.cwd();
const frontendDist = path.join(repoRoot, 'frontend', 'dist');

function quote(p) {
  if (process.platform === 'win32') return `"${p}"`;
  return `"${p.replace(/(["\\$`])/g, '\\$1')}"`;
}

try {
  console.log('Building frontend (base=' + base + ')...');
  execSync(`npm run build --prefix frontend -- --base=${base}`, { stdio: 'inherit' });
} catch (err) {
  console.error('Build failed.');
  process.exit(1);
}

if (!fs.existsSync(frontendDist)) {
  console.error('Missing frontend/dist — build did not produce output.');
  process.exit(1);
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-static-'));
const tmpDist = path.join(tmpRoot, 'dist');

try {
  if (fs.cpSync) {
    fs.cpSync(frontendDist, tmpDist, { recursive: true });
  } else {
    const copyRecursive = (src, dest) => {
      const stat = fs.statSync(src);
      if (stat.isDirectory()) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest);
        for (const f of fs.readdirSync(src)) copyRecursive(path.join(src, f), path.join(dest, f));
      } else {
        fs.copyFileSync(src, dest);
      }
    };
    copyRecursive(frontendDist, tmpDist);
  }

  const outZip = path.join(repoRoot, 'deploy_static.zip');
  if (fs.existsSync(outZip)) fs.unlinkSync(outZip);

  console.log('Creating zip:', outZip);

  if (process.platform === 'win32') {
    const psSrc = tmpDist.replace(/'/g, "''") + '\\*';
    const psOut = outZip.replace(/'/g, "''");
    const cmd = `powershell -NoProfile -Command "Compress-Archive -Force -Path '${psSrc}' -DestinationPath '${psOut}'"`;
    execSync(cmd, { stdio: 'inherit' });
  } else {
    execSync(`zip -r -q ${quote(path.join(repoRoot, 'deploy_static.zip'))} .`, { cwd: tmpDist, stdio: 'inherit' });
  }

  console.log('deploy_static.zip created at repo root.');
} catch (err) {
  console.error('Error creating zip:', err.message || err);
  process.exit(1);
} finally {
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_) {}
}