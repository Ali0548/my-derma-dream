import { spawn } from 'node:child_process';

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: false });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code}`));
    });
  });
}

async function main() {
  await run('node', ['./scripts/wait-for-db.mjs']);
  await run('node', ['./scripts/migrate.mjs']);
  await run('node', ['./scripts/seed.mjs']);
  await run('node', ['./scripts/initial-seeds.mjs']);
  await run('node', ['./dist/jobs/recalcCommissions.js']);
  await run('node', ['dist/server.js']);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
