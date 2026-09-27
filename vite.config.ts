import { execFileSync } from 'node:child_process';
import { defineConfig } from 'vite';

function readGitHead(): string {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      windowsHide: true,
    }).trim();
  } catch {
    return 'UNKNOWN';
  }
}

export default defineConfig(({ command }) => {
  const gitHead = readGitHead();
  const buildIdentity = {
    gitHead,
    timestamp: command === 'serve' ? new Date().toISOString() : `git:${gitHead}`,
  };

  return {
    define: { __ROBOTLAB_BUILD_IDENTITY__: JSON.stringify(buildIdentity) },
  };
});
