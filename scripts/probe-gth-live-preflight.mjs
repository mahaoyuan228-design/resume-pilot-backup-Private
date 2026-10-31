// Read-only: select one existing exact GTH URL on the specified loopback CDP port.
// Never opens a page, focuses a window, changes visibility, reads values, or fills.
import { connectCdp, getJson } from '../tools/live-harvest/cdp-client.mjs';
import { readGthLivePreflight, assessGthLivePreflight } from './lib/gth-live-preflight.mjs';

const port = Number(process.argv[2] || 9239);
let session;
try {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('invalid_cdp_port');
  const targets = await getJson(port, '/json/list', { timeoutMs: 5000, step: 'preflight_targets' });
  const matches = targets.filter(t => t.type === 'page' && t.url === 'https://hr.gtht.com/resume/edit/');
  if (matches.length !== 1) throw Error('gth_tab_not_unique');
  session = await connectCdp(matches[0].webSocketDebuggerUrl, { timeoutMs: 5000, step: 'preflight_attach' });
  const result = await session.send('Runtime.evaluate', {
    expression: '(' + readGthLivePreflight.toString() + ')()',
    returnByValue: true,
  });
  if (result.exceptionDetails || !result.result?.value) throw Error('preflight_probe_failed');
  const probe = result.result.value;
  const decision = assessGthLivePreflight(probe);
  console.log(JSON.stringify({ port, ...decision, probe }, null, 2));
  if (!decision.ok) process.exitCode = 2;
} catch (error) {
  const reason = error?.code || error?.message || 'preflight_failed';
  console.log(JSON.stringify({ port, ok: false, reason }));
  process.exitCode = 2;
} finally { session?.close(); }
