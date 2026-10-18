// Canonical entry for CMS internship auto is cms-education-auto.html with
// mode=internship_readiness|internship_fill (Edge historically executed that
// page reliably; direct cms-internship-auto.html module stayed silent until a
// full unpacked Load). This file redirects to that delegate with the same query.
(() => {
  try {
    const port = Number.parseInt(new URLSearchParams(location.search).get('reportPort') || '0', 10);
    if (Number.isSafeInteger(port) && port > 0) {
      fetch(`http://127.0.0.1:${port}/event`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ event: 'internship_js_boot_redirect', href: location.href, at: Date.now() })
      }).catch(() => {});
    }
  } catch { /* ignore */ }
})();

const params = new URLSearchParams(location.search);
const mode = params.get('mode') || 'readiness';
const mapped = mode === 'fill' || mode === 'internship_fill'
  ? 'internship_fill'
  : mode === 'reload'
    ? 'reload'
    : 'internship_readiness';
params.set('mode', mapped);
const target = chrome.runtime.getURL(`src/auto/cms-education-auto.html?${params.toString()}`);
location.replace(target);
