import { execFileSync, spawn } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOST = '0.0.0.0';
const PORT = 4198;
const LOOPBACK_URL = `http://127.0.0.1:${PORT}/`;
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VITE_BIN = path.join(PROJECT_ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
const OUT_LOG = path.join(PROJECT_ROOT, 'robotlab-preview.out.log');
const ERR_LOG = path.join(PROJECT_ROOT, 'robotlab-preview.err.log');
const REJECTED_ADAPTER = /(vpn|tap|tun|docker|wsl|vethernet|hyper-v|loopback|virtual|vmware|virtualbox)/i;
const PREFERRED_ADAPTER = /(^|\b)(wi-?fi|wireless|ethernet)(\b|$)/i;
const ROBOTLAB_TITLE = '<title>Почини робота — RobotLab</title>';

function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function isUsableIpv4(address) {
  return typeof address === 'string' && /^\d{1,3}(?:\.\d{1,3}){3}$/.test(address) &&
    !address.startsWith('127.') && !address.startsWith('169.254.') && address !== '0.0.0.0';
}

function getWindowsLanCandidates() {
  if (process.platform !== 'win32') return [];
  const command = [
    '[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()',
    '$items = Get-NetIPConfiguration | ForEach-Object {',
    '  $config = $_',
    '  $config.IPv4Address | ForEach-Object {',
    '    [PSCustomObject]@{ Name = $config.InterfaceAlias; Description = $config.NetAdapter.InterfaceDescription; Status = $config.NetAdapter.Status; Address = $_.IPAddress; HasDefaultRoute = [bool]$config.IPv4DefaultGateway }',
    '  }',
    '}',
    '$items | ConvertTo-Json -Compress',
  ].join('\n');
  try {
    const output = execFileSync('powershell.exe', ['-NoProfile', '-Command', command], { encoding: 'utf8', windowsHide: true }).trim();
    if (!output) return [];
    return asArray(JSON.parse(output))
      .filter((item) => item.Status === 'Up' && isUsableIpv4(item.Address))
      .filter((item) => !REJECTED_ADAPTER.test(`${item.Name} ${item.Description}`))
      .map((item) => ({ name: item.Name, description: item.Description, address: item.Address, hasDefaultRoute: Boolean(item.HasDefaultRoute) }));
  } catch (error) {
    console.warn(`Windows adapter inspection failed: ${error.message}`);
    return [];
  }
}

function getPortableLanCandidates() {
  return Object.entries(os.networkInterfaces()).flatMap(([name, addresses]) => {
    if (REJECTED_ADAPTER.test(name)) return [];
    return (addresses ?? []).filter((item) => item.family === 'IPv4' && !item.internal && isUsableIpv4(item.address))
      .map((item) => ({ name, description: name, address: item.address, hasDefaultRoute: false }));
  });
}

function chooseLanAdapter() {
  const windowsCandidates = getWindowsLanCandidates();
  const available = windowsCandidates.length > 0 ? windowsCandidates : getPortableLanCandidates();
  if (available.length === 0) throw new Error('No active physical LAN IPv4 adapter was found.');
  const score = (item) => (item.hasDefaultRoute ? 100 : 0) + (PREFERRED_ADAPTER.test(`${item.name} ${item.description}`) ? 10 : 0);
  const ranked = [...available].sort((left, right) => score(right) - score(left) || left.name.localeCompare(right.name));
  console.log('PHYSICAL LAN CANDIDATES:');
  for (const item of ranked) console.log(`- ${item.name}: ${item.address}${item.hasDefaultRoute ? ' (default route)' : ''}`);
  return ranked[0];
}

function request(url, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const operation = http.get(url, { timeout: timeoutMs }, (response) => {
      response.setEncoding('utf8');
      let body = '';
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode ?? 0, body }));
    });
    operation.on('timeout', () => operation.destroy(new Error(`Timed out: ${url}`)));
    operation.on('error', reject);
  });
}

function isProductionRobotLab(response) {
  return response.status === 200 && response.body.includes(ROBOTLAB_TITLE) &&
    /<script[^>]+src="\/assets\/[^"?]+\.js"/.test(response.body) && !response.body.includes('/@vite/client');
}

function getListener() {
  if (process.platform !== 'win32') return null;
  const command = [
    '[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()',
    `$listener = Get-NetTCPConnection -LocalPort ${PORT} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1`,
    'if ($listener) {',
    '  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)"',
    '  [PSCustomObject]@{ Address = $listener.LocalAddress; Pid = $listener.OwningProcess; CommandLine = $process.CommandLine } | ConvertTo-Json -Compress',
    '}',
  ].join('\n');
  try {
    const output = execFileSync('powershell.exe', ['-NoProfile', '-Command', command], { encoding: 'utf8', windowsHide: true }).trim();
    return output ? JSON.parse(output) : null;
  } catch { return null; }
}

function listenerBelongsToRobotLab(listener) {
  const commandLine = String(listener?.CommandLine ?? '').toLowerCase();
  return commandLine.includes(PROJECT_ROOT.toLowerCase()) && commandLine.includes('vite');
}

function listenerIsPreview(listener) {
  return /vite(?:\.js)?["']?\s+preview\b/i.test(String(listener?.CommandLine ?? ''));
}

function listenerIsPublic(listener) {
  return ['0.0.0.0', '::'].includes(String(listener?.Address ?? ''));
}

function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function stopRobotLabListener(listener) {
  console.log(`Stopping stale RobotLab Vite process ${listener.Pid} on port ${PORT}.`);
  if (process.platform === 'win32') {
    execFileSync('taskkill.exe', ['/PID', String(listener.Pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
  } else {
    process.kill(listener.Pid, 'SIGTERM');
  }
}

function startPreview() {
  const stdout = openSync(OUT_LOG, 'a');
  const stderr = openSync(ERR_LOG, 'a');
  const child = spawn(process.execPath, [VITE_BIN, 'preview', '--host', HOST, '--port', String(PORT), '--strictPort'], {
    cwd: PROJECT_ROOT, detached: true, windowsHide: true, stdio: ['ignore', stdout, stderr],
  });
  child.unref();
  closeSync(stdout);
  closeSync(stderr);
  console.log(`Started RobotLab production preview launcher process ${child.pid}.`);
  return child.pid;
}

async function waitForProductionPreview() {
  const deadline = Date.now() + 30000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await request(LOOPBACK_URL);
      if (isProductionRobotLab(response)) return;
      lastError = new Error('Port 4198 did not return the RobotLab production build.');
    } catch (error) { lastError = error; }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw lastError ?? new Error('RobotLab production preview did not become ready.');
}

async function verify(url) {
  const response = await request(url);
  if (!isProductionRobotLab(response)) throw new Error(`${url} did not return the RobotLab production build (HTTP ${response.status}).`);
}

async function main() {
  const adapter = chooseLanAdapter();
  const lanUrl = `http://${adapter.address}:${PORT}/`;
  const mission9Local = `${LOOPBACK_URL}?qaMission=9`;
  const mission9Lan = `${lanUrl}?qaMission=9`;
  let listener = getListener();
  let startedPid = null;

  if (listener) {
    let localResponse = null;
    try { localResponse = await request(LOOPBACK_URL); } catch {}
    const reusable = localResponse && isProductionRobotLab(localResponse) && listenerBelongsToRobotLab(listener) && listenerIsPreview(listener) && listenerIsPublic(listener);
    if (reusable) {
      console.log(`Reusing RobotLab production preview process ${listener.Pid}.`);
    } else if (listenerBelongsToRobotLab(listener)) {
      stopRobotLabListener(listener);
      listener = null;
    } else {
      throw new Error(`Port ${PORT} is occupied by unrelated process ${listener.Pid}; it was not stopped.`);
    }
  }

  if (!listener) {
    if (process.platform !== 'win32') {
      try {
        await request(LOOPBACK_URL);
        throw new Error(`Port ${PORT} is already occupied and its owner cannot be safely identified on this platform.`);
      } catch (error) {
        if (error.message.includes('already occupied')) throw error;
      }
    }
    startedPid = startPreview();
    await waitForProductionPreview();
    listener = getListener();
    if (!listener && startedPid && processExists(startedPid)) {
      listener = {
        Address: HOST,
        Pid: startedPid,
        CommandLine: `node "${VITE_BIN}" preview --host ${HOST} --port ${PORT} --strictPort`,
      };
    }
  }

  await verify(LOOPBACK_URL);
  await verify(lanUrl);
  await verify(mission9Local);
  await verify(mission9Lan);
  if (!listener || !listenerBelongsToRobotLab(listener) || !listenerIsPreview(listener) || !listenerIsPublic(listener)) {
    throw new Error('The verified preview listener identity, mode, or bind address could not be confirmed.');
  }

  console.log('');
  console.log('MANUAL REVIEW: READY');
  console.log('SERVER: RUNNING');
  console.log('MODE: PRODUCTION PREVIEW');
  console.log('HMR: ABSENT');
  console.log(`PROCESS: ${listener.Pid}`);
  console.log(`LISTEN: ${HOST}:${PORT}`);
  console.log(`CURRENT LAN IPV4: ${adapter.address}`);
  console.log(`PC URL: ${LOOPBACK_URL}`);
  console.log(`SAMSUNG URL: ${lanUrl}`);
  console.log(`MISSION 9 PC DIRECT: ${mission9Local}`);
  console.log(`MISSION 9 SAMSUNG DIRECT: ${mission9Lan}`);
  console.log('PC HTTP: PASS');
  console.log('LAN HTTP: PASS');
  console.log('DIRECT QA HTTP: PASS');
  console.log('SERVER LEFT RUNNING: YES');
}

main().catch((error) => {
  console.error('MANUAL REVIEW: NOT READY');
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
});
