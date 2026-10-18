// Internal one-shot helper: no toolbar popup. Default fill; readiness optional.
const params = new URLSearchParams(location.search);
const mode = params.get('mode') || 'fill';
const openIfMissing = params.get('openIfMissing') !== '0' && params.get('openIfMissing') !== 'false';
const reportPort = Number.parseInt(params.get('reportPort') || '0', 10);
const targetPage = params.get('targetPage') || '';
const statusEl = document.getElementById('status');
const outEl = document.getElementById('out');
const MSG_TYPE = 'HOTJOB_MC_BASIC_AUTO';
const LABEL = 'hotjob-mc';

function show(state, payload) {
  statusEl.textContent = state;
  statusEl.className = /失败|帮助|help|我需要/i.test(state) ? 'bad' : /完成|ok|已重新加载|就绪/i.test(state) ? 'ok' : '';
  outEl.textContent = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
}

async function postReport(payload) {
  if (!Number.isSafeInteger(reportPort) || reportPort < 1) return { posted: false };
  try {
    const response = await fetch(`http://127.0.0.1:${reportPort}/result`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { posted: response.ok, status: response.status };
  } catch (error) {
    return { posted: false, error: String(error?.message || error) };
  }
}

async function postEvent(event, extra = {}) {
  if (!Number.isSafeInteger(reportPort) || reportPort < 1) return;
  try {
    await fetch(`http://127.0.0.1:${reportPort}/event`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event, at: Date.now(), ...extra })
    });
  } catch { /* ignore */ }
}

if (mode === 'reload') {
  show('正在重新加载扩展 service worker…', { mode });
  await postEvent('reload_begin');
  try {
    chrome.runtime.reload();
  } catch (error) {
    show('重新加载失败', { error: String(error?.message || error) });
    await postReport({ ok: false, reason: 'extension_reload_failed', error: String(error?.message || error) });
  }
} else {
  const autoMode = ['readiness', 'fill'].includes(mode) ? mode : 'fill';
  show(`正在请求后台 ${MSG_TYPE}（mode=${autoMode}）…`, { openIfMissing, reportPort, targetPage: targetPage || null });
  await postEvent('auto_begin', { autoMode, openIfMissing, targetPage: targetPage || null });
  try {
    const message = {
      type: MSG_TYPE,
      mode: autoMode,
      openIfMissing,
      originConfirmed: true
    };
    if (targetPage) message.targetPage = targetPage;
    const result = await chrome.runtime.sendMessage(message);
    if (result == null) {
      const payload = {
        ok: false,
        reason: 'extension_reload_required',
        helpNeeded: false,
        hint: `Service worker has no ${MSG_TYPE} yet; run with mode=reload first`
      };
      const posted = await postReport(payload);
      show(`扩展尚未加载 ${LABEL} 自动代码，请先 reload`, { ...payload, posted });
    } else {
      const posted = await postReport(result || { ok: false, reason: 'empty_response' });
      if (result?.helpNeeded) {
        show(`我需要帮助！ ${result.helpReason || result.reason || ''}`.trim(), { ...result, posted });
      } else if (result?.ok) {
        show(`${LABEL} 基本信息自动完成：mode=${result.mode || autoMode} state=${result.job?.state || result.readiness?.pageState || '?'}`, { ...result, posted });
      } else {
        show(`${LABEL} 基本信息自动失败：${result?.reason || 'unknown'}`, { ...result, posted });
      }
    }
  } catch (error) {
    const payload = { ok: false, reason: String(error?.message || error), helpNeeded: false };
    const posted = await postReport(payload);
    show(`${LABEL} 基本信息自动异常：${payload.reason}`, { ...payload, posted });
  }
}
