const { execFileSync, spawnSync } = require('child_process');

const docker = 'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe';
const maxAttempts = 90;

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

for (let i = 1; i <= maxAttempts; i += 1) {
  const result = spawnSync(docker, ['info'], { encoding: 'utf8' });
  if (result.status === 0) {
    console.log(`Docker ready on attempt ${i}`);
    process.exit(0);
  }
  console.log(`Waiting for Docker engine (${i}/${maxAttempts})...`);
  if (result.stderr) {
    const line = String(result.stderr).split('\n')[0];
    if (line) console.log(line);
  }
  sleep(4000);
}

console.error('Docker engine did not become ready');
process.exit(1);
