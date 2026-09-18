const { existsSync } = require('fs');
const { execSync, spawn } = require('child_process');

const candidates = [
  'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe',
  'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe',
  process.env.LOCALAPPDATA + '\\Docker\\Docker Desktop.exe',
  process.env.LOCALAPPDATA + '\\Programs\\Docker\\Docker\\Docker Desktop.exe',
];

for (const p of candidates) {
  console.log((existsSync(p) ? 'FOUND ' : 'MISS  ') + p);
}

try {
  console.log('where docker:');
  console.log(execSync('where docker', { encoding: 'utf8' }));
} catch {
  console.log('docker not on PATH yet');
}

const desktop = candidates.find((p) => p.endsWith('Docker Desktop.exe') && existsSync(p));
if (desktop) {
  console.log('Starting:', desktop);
  spawn(desktop, [], { detached: true, stdio: 'ignore' }).unref();
}
