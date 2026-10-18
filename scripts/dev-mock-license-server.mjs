#!/usr/bin/env node
/**
 * DEV-ONLY local license /v1/verify mock for paid-build smoke.
 *
 * NEVER package into Edge internal or paid customer ZIPs.
 * NEVER point production installs at this process.
 * Does NOT implement payment, orders, or real entitlement issuance.
 *
 * Contract (compatible with src/license/client.mjs verifyOnline):
 *   POST /v1/verify  JSON { installId, profileHash? }
 *   → 200 JSON { status, installId, profileHash, licenseId, expiresAtMs }
 *     or non-OK HTTP for unreachable / deny-at-transport tests
 *
 * Listen: HTTPS on 127.0.0.1 by default (matches assertPaidConfig https:// requirement).
 * Optional --http for plain HTTP (DEV only; cannot drive build-paid.ps1 which requires https://).
 *
 * Usage:
 *   node scripts/dev-mock-license-server.mjs
 *   node scripts/dev-mock-license-server.mjs --port 8787 --mode allow
 *   MOCK_LICENSE_MODE=deny node scripts/dev-mock-license-server.mjs
 *
 * Modes: allow | deny | expired | revoked | device_revoked | mismatch | http_500 | http_503
 */

import http from 'node:http';
import https from 'node:https';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEV_CERT_DIR = join(__dirname, 'dev-mock-license-certs');
const DEV_KEY_PATH = join(DEV_CERT_DIR, 'DEV-ONLY-localhost-key.pem');
const DEV_CERT_PATH = join(DEV_CERT_DIR, 'DEV-ONLY-localhost-cert.pem');

const BANNER = [
  '',
  '══════════════════════════════════════════════════════════════',
  '  DEV-ONLY mock license server — NOT for production',
  '  Do not package this script or its certs into Edge builds',
  '══════════════════════════════════════════════════════════════',
  '',
].join('\n');

function parseArgs(argv) {
  const out = {
    port: 8787,
    host: '127.0.0.1',
    mode: process.env.MOCK_LICENSE_MODE || 'allow',
    http: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--http') out.http = true;
    else if (a === '--https') out.http = false;
    else if (a === '--port' && argv[i + 1]) out.port = Number(argv[++i]);
    else if (a === '--host' && argv[i + 1]) out.host = argv[++i];
    else if (a === '--mode' && argv[i + 1]) out.mode = String(argv[++i]);
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}


function resolveOpensslBinary() {
  const candidates = [
    process.env.OPENSSL_BIN,
    'openssl',
    'C:\\Program Files\\Git\\usr\\bin\\openssl.exe',
    'C:\\Program Files (x86)\\Git\\usr\\bin\\openssl.exe',
  ].filter(Boolean);
  for (const bin of candidates) {
    const probe = spawnSync(bin, ['version'], { encoding: 'utf8' });
    if (probe.status === 0) return bin;
  }
  return 'openssl';
}

/** Minimal self-signed RSA cert for 127.0.0.1 / localhost (DEV ONLY). */
export function ensureDevTlsMaterialSync() {
  if (existsSync(DEV_KEY_PATH) && existsSync(DEV_CERT_PATH)) {
    return {
      key: readFileSync(DEV_KEY_PATH),
      cert: readFileSync(DEV_CERT_PATH),
    };
  }
  mkdirSync(DEV_CERT_DIR, { recursive: true });
  const conf = join(DEV_CERT_DIR, 'openssl-dev.cnf');
  writeFileSync(conf, [
    '[req]',
    'distinguished_name = dn',
    'x509_extensions = v3_req',
    'prompt = no',
    '[dn]',
    'CN = localhost',
    'O = ResumeQuickFill DEV-ONLY',
    '[v3_req]',
    'subjectAltName = @alt',
    'basicConstraints = CA:FALSE',
    'keyUsage = digitalSignature, keyEncipherment',
    'extendedKeyUsage = serverAuth',
    '[alt]',
    'DNS.1 = localhost',
    'IP.1 = 127.0.0.1',
    '',
  ].join('\n'));
  const opensslBin = resolveOpensslBinary();
  const gen = spawnSync(opensslBin, [
    'req', '-x509', '-newkey', 'rsa:2048', '-sha256', '-days', '825',
    '-nodes', '-keyout', DEV_KEY_PATH, '-out', DEV_CERT_PATH,
    '-config', conf,
  ], { encoding: 'utf8' });
  if (gen.status !== 0) {
    throw new Error(
      `openssl_required_for_dev_https: ${(gen.stderr || gen.stdout || 'openssl failed').trim()}. `
      + 'Ship scripts/dev-mock-license-certs/DEV-ONLY-localhost-*.pem, install openssl/Git, or pass --http '
      + '(HTTP is DEV-only; build-paid requires https://).',
    );
  }
  writeFileSync(
    join(DEV_CERT_DIR, 'README-DEV-ONLY.txt'),
    'Ephemeral / local DEV-ONLY TLS material for scripts/dev-mock-license-server.mjs.\n'
    + 'Never trust in production. Never ship inside Edge packages.\n',
  );
  return {
    key: readFileSync(DEV_KEY_PATH),
    cert: readFileSync(DEV_CERT_PATH),
  };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 65536) {
        reject(Object.assign(new Error('body_too_large'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(Object.assign(new Error('json_invalid'), { statusCode: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, body) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    'X-Resume-Mock-License': 'DEV-ONLY',
  });
  res.end(payload);
}

function resolveMode(req, defaultMode) {
  try {
    const u = new URL(req.url || '/', 'http://127.0.0.1');
    const q = u.searchParams.get('mode');
    if (q) return q;
  } catch { /* ignore */ }
  const h = req.headers['x-mock-license-mode'];
  if (typeof h === 'string' && h.trim()) return h.trim();
  return defaultMode;
}

/**
 * Build /v1/verify response for the given mode + request body.
 * Exported for unit/smoke tests without starting a listener.
 */
export function buildVerifyResponse(mode, body = {}) {
  const installId = typeof body.installId === 'string' ? body.installId : null;
  const profileHash = body.profileHash ?? null;
  const now = Date.now();
  const base = {
    installId,
    profileHash,
    licenseId: 'dev-mock-lic',
  };

  switch (String(mode || 'allow').toLowerCase()) {
    case 'allow':
    case 'active':
      return {
        statusCode: 200,
        body: {
          ...base,
          status: 'active',
          expiresAtMs: now + 7 * 24 * 60 * 60 * 1000,
        },
      };
    case 'deny':
    case 'not_activated':
      return {
        statusCode: 200,
        body: {
          ...base,
          status: 'inactive',
          expiresAtMs: now + 7 * 24 * 60 * 60 * 1000,
        },
      };
    case 'expired':
      return {
        statusCode: 200,
        body: {
          ...base,
          status: 'active',
          expiresAtMs: now - 1000,
        },
      };
    case 'revoked':
      return {
        statusCode: 200,
        body: {
          ...base,
          status: 'revoked',
          expiresAtMs: now + 7 * 24 * 60 * 60 * 1000,
        },
      };
    case 'device_revoked':
      return {
        statusCode: 200,
        body: {
          ...base,
          status: 'device_revoked',
          expiresAtMs: now + 7 * 24 * 60 * 60 * 1000,
        },
      };
    case 'mismatch':
      return {
        statusCode: 200,
        body: {
          ...base,
          installId: '99999999-9999-4999-a999-999999999999',
          status: 'active',
          expiresAtMs: now + 7 * 24 * 60 * 60 * 1000,
        },
      };
    case 'http_500':
      return { statusCode: 500, body: { error: 'dev_mock_internal', mode: 'http_500' } };
    case 'http_503':
      return { statusCode: 503, body: { error: 'dev_mock_unavailable', mode: 'http_503' } };
    default:
      return {
        statusCode: 400,
        body: {
          error: 'unknown_mode',
          mode,
          hint: 'allow|deny|expired|revoked|device_revoked|mismatch|http_500|http_503',
        },
      };
  }
}

export function createMockLicenseRequestListener(defaultMode = 'allow') {
  return async function onRequest(req, res) {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      sendJson(res, 200, {
        ok: true,
        role: 'DEV-ONLY-mock-license',
        mode: defaultMode,
        verifyPath: '/v1/verify',
        note: 'Not a production license service',
      });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/v1/verify') {
      let body;
      try {
        body = await readJsonBody(req);
      } catch (error) {
        sendJson(res, error.statusCode || 400, { error: error.message || 'bad_request' });
        return;
      }
      const mode = resolveMode(req, defaultMode);
      const result = buildVerifyResponse(mode, body);
      sendJson(res, result.statusCode, result.body);
      return;
    }
    sendJson(res, 404, { error: 'not_found', path: url.pathname });
  };
}

/**
 * Start the mock server. Returns { baseUrl, protocol, port, host, close, mode }.
 */
export function startMockLicenseServer(options = {}) {
  const host = options.host || '127.0.0.1';
  const port = Number.isFinite(options.port) ? options.port : 8787;
  const mode = options.mode || 'allow';
  const useHttp = options.http === true;
  const listener = createMockLicenseRequestListener(mode);

  let server;
  let protocol;
  if (useHttp) {
    protocol = 'http';
    server = http.createServer(listener);
  } else {
    protocol = 'https';
    const tls = options.tls || ensureDevTlsMaterialSync();
    server = https.createServer(tls, listener);
  }

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const address = server.address();
      const actualPort = typeof address === 'object' && address ? address.port : port;
      const baseUrl = `${protocol}://${host}:${actualPort}`;
      resolve({
        baseUrl,
        protocol,
        host,
        port: actualPort,
        mode,
        server,
        close: () => new Promise((done, fail) => {
          server.close((err) => (err ? fail(err) : done()));
        }),
      });
    });
  });
}

function printHelp() {
  console.log(`DEV-ONLY mock license server

  node scripts/dev-mock-license-server.mjs [--port 8787] [--host 127.0.0.1] [--mode allow] [--http]

  Modes: allow | deny | expired | revoked | device_revoked | mismatch | http_500 | http_503
  Per-request override: ?mode=expired or header X-Mock-License-Mode: revoked

  Paid smoke (HTTPS, self-signed):
    node scripts/dev-mock-license-server.mjs --port 8787 --mode allow
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-paid.ps1 -LicenseServiceUrl 'https://127.0.0.1:8787'
    node --test tests/license-mock-server-smoke.test.mjs

  NEVER package this into Edge internal builds.
`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return;
  }
  console.log(BANNER);
  const started = await startMockLicenseServer({
    host: args.host,
    port: args.port,
    mode: args.mode,
    http: args.http,
  });
  console.log(`Listening: ${started.baseUrl}`);
  console.log(`Default mode: ${started.mode}`);
  console.log('POST /v1/verify  |  GET /health');
  if (started.protocol === 'https') {
    console.log(`DEV cert dir: ${DEV_CERT_DIR}`);
    console.log('Browsers will warn on self-signed cert — Node smoke uses rejectUnauthorized:false.');
  } else {
    console.log('HTTP mode: DEV-ONLY. assertPaidConfig / build-paid.ps1 require https:// — use HTTPS for paid package smoke.');
  }
  console.log('Ctrl+C to stop.\n');
}

const isDirect = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirect) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
