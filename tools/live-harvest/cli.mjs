#!/usr/bin/env node
/**
 * Read-only live harvest CLI. Never Save. Does not claim any site is supported.
 *
 *   node tools/live-harvest/cli.mjs --port 9237,9239 --sites cmb,nanyue,gth,cms,ext-storage --out-dir ./live-harvest-out --run-id 2026-10-19
 */
import fs from 'node:fs';
import { DEFAULT_PORTS, DEFAULT_SITES, runLiveHarvest } from './run.mjs';

const HELP = `Usage: node tools/live-harvest/cli.mjs [options]

Read-only CDP probes against already-open browser tabs. Never Save.
Does not claim CMB, 南粤, GTH, or CMS is supported.

Options:
  --port <n[,n]>          Loopback CDP port. Repeatable. Default ${DEFAULT_PORTS.join(',')}
  --sites <a,b>           ${DEFAULT_SITES.join(',')}
  --out-dir <dir>         Evidence directory. Default ./live-harvest-out
  --run-id <id>           Run id stamped into every packet
  --step-timeout-ms <n>   Hard timeout for each CDP call. Default 8000
  --deadline-ms <n>       Global deadline. Default 120000
  --help                  Show this help
`;

function parseArgs(argv) {
  const opts = {
    ports: [],
    sites: null,
    outDir: null,
    runId: null,
    stepTimeoutMs: 8000,
    deadlineMs: 120000,
    help: false
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) throw new Error(`missing value for ${arg}`);
      return argv[i];
    };
    if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--port') {
      for (const part of next().split(',')) {
        const port = Number(part.trim());
        if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error(`bad port: ${part}`);
        opts.ports.push(port);
      }
    } else if (arg === '--sites') {
      opts.sites = next().split(',').map((part) => part.trim()).filter(Boolean);
    } else if (arg === '--out-dir') opts.outDir = next();
    else if (arg === '--run-id') opts.runId = next();
    else if (arg === '--step-timeout-ms') opts.stepTimeoutMs = Number(next());
    else if (arg === '--deadline-ms') opts.deadlineMs = Number(next());
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!Number.isFinite(opts.stepTimeoutMs) || opts.stepTimeoutMs <= 0) throw new Error('bad --step-timeout-ms');
  if (!Number.isFinite(opts.deadlineMs) || opts.deadlineMs <= 0) throw new Error('bad --deadline-ms');
  return opts;
}

try {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    process.stdout.write(HELP);
    process.exit(0);
  }

  const summary = await runLiveHarvest({
    ports: opts.ports.length ? opts.ports : [...DEFAULT_PORTS],
    sites: opts.sites,
    outDir: opts.outDir || 'live-harvest-out',
    runId: opts.runId,
    stepTimeoutMs: opts.stepTimeoutMs,
    deadlineMs: opts.deadlineMs
  });

  fs.writeSync(1, `${JSON.stringify({
    ok: summary.ok,
    exitCode: summary.exitCode,
    summaryPath: summary.summaryPath,
    timedOut: summary.timedOut,
    neverSave: summary.neverSave,
    claimedSupported: summary.claimedSupported,
    results: summary.results
  })}\n`);
  process.exit(summary.exitCode);
} catch (err) {
  process.stderr.write(`${err?.message || err}\n`);
  process.exit(1);
}
