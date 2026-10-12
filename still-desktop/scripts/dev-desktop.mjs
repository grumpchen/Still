import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cargoBin = join(process.env.USERPROFILE ?? process.env.HOME ?? '', '.cargo', 'bin');
const cargo = join(cargoBin, process.platform === 'win32' ? 'cargo.exe' : 'cargo');
const tauriCli = join(projectRoot, 'node_modules', '@tauri-apps', 'cli', 'tauri.js');
const env = {
  ...process.env,
  RUST_BACKTRACE: process.env.RUST_BACKTRACE ?? '1',
};

if (existsSync(cargo)) {
  const pathEntries = (env.PATH ?? '').split(delimiter);
  if (!pathEntries.some(entry => resolve(entry).toLowerCase() === resolve(cargoBin).toLowerCase())) {
    env.PATH = [cargoBin, ...pathEntries].filter(Boolean).join(delimiter);
  }
}

const child = spawn(process.execPath, [
  tauriCli,
  'dev',
  '--verbose',
  '--config',
  'src-tauri/tauri.dev.conf.json',
  ...process.argv.slice(2),
], {
  cwd: projectRoot,
  env,
  stdio: 'inherit',
});

child.on('error', error => {
  console.error(`Could not start Tauri development mode: ${error.message}`);
  process.exitCode = 1;
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`Tauri development mode exited after ${signal}.`);
    process.exitCode = 1;
  } else {
    process.exitCode = code ?? 1;
  }
});
