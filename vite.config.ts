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

const buildIdentity = {
  gitHead: readGitHead(),
  timestamp: new Date().toISOString(),
};

export default defineConfig({
  define: { __ROBOTLAB_BUILD_IDENTITY__: JSON.stringify(buildIdentity) },
});
