// Internal one-shot helper: no toolbar popup. Can self-reload SW once, then fill.
const params = new URLSearchParams(location.search);
const mode = params.get('mode') || 'fill';
const profileIndex = Number.parseInt(params.get('profileIndex') || '5', 10);
const alsoRaw = params.get('alsoProfileIndexes') || params.get('alsoProfileIndex') || '';
const alsoProfileIndexes = alsoRaw.split(/[,\s]+/).map((v) => Number.parseInt(v, 10)).filter((n) => Number.isInteger(n) && n >= 0 && n <= 29 && n !== profileIndex);
const replaceExisting = params.get('replaceExisting') !== '0' && params.get('replaceExisting') !== 'false';
const reportPort = Number.parseInt(params.get('reportPort') || '0', 10);
const statusEl = document.getElementById('status');
const outEl = document.getElementById('out');

function show(state, payload) {
  statusEl.textContent = state;
  statusEl.className = /失败|帮助|help|我需要/i.test(state) ? 'bad' : /完成|ok|已重新加载/i.test(state) ? 'ok' : '';
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
} else if (mode === 'basic_readiness' || mode === 'basic_fill') {
  const autoMode = mode === 'basic_fill' ? 'fill' : 'readiness';
  show(`正在请求后台 CMS_BASIC_AUTO（mode=${autoMode}）…`, { reportPort });
  await postEvent('auto_begin', { autoMode, via: 'cms-education-auto' });
  try {
    const result = await chrome.runtime.sendMessage({
      type: 'CMS_BASIC_AUTO',
      mode: autoMode,
      originConfirmed: true
    });
    if (result == null) {
      const payload = {
        ok: false,
        reason: 'extension_reload_required',
        helpNeeded: false,
        hint: 'Service worker has no CMS_BASIC_AUTO yet; run with mode=reload first'
      };
      const posted = await postReport(payload);
      show('扩展尚未加载个人基本信息自动代码，请先 reload', { ...payload, posted });
    } else {
      const posted = await postReport(result || { ok: false, reason: 'empty_response' });
      if (result?.helpNeeded) {
        show(`我需要帮助！ ${result.helpReason || result.reason || ''}`.trim(), { ...result, posted });
      } else if (result?.ok) {
        const stateLabel = result.job?.state ?? result.readiness?.pageState ?? '?';
        show(`个人基本信息自动完成：mode=${result.mode || autoMode} state=${stateLabel}`, { ...result, posted });
      } else {
        show(`个人基本信息自动失败：${result?.reason || 'unknown'}`, { ...result, posted });
      }
    }
  } catch (error) {
    const payload = { ok: false, reason: String(error?.message || error), helpNeeded: false };
    const posted = await postReport(payload);
    show(`个人基本信息自动异常：${payload.reason}`, { ...payload, posted });
  }
} else if (mode === 'internship_readiness' || mode === 'internship_fill') {
  // CANONICAL internship auto entry (launcher + cms-internship-auto.js redirect here).
  // Direct cms-internship-auto.html historically opened (title visible) but its
  // module never posted events in Edge 003753 until a full unpacked Load.
  const autoMode = mode === 'internship_fill' ? 'fill' : 'readiness';
  show(`正在请求后台 CMS_INTERNSHIP_AUTO（mode=${autoMode}）…`, { profileIndex, replaceExisting, reportPort });
  await postEvent('auto_begin', { autoMode, profileIndex, replaceExisting, via: 'cms-education-auto' });
  try {
    const result = await chrome.runtime.sendMessage({
      type: 'CMS_INTERNSHIP_AUTO',
      mode: autoMode,
      profileIndex,
      replaceExisting
    });
    if (result == null) {
      const payload = {
        ok: false,
        reason: 'extension_reload_required',
        helpNeeded: false,
        hint: 'Service worker has no CMS_INTERNSHIP_AUTO yet; run with mode=reload first'
      };
      const posted = await postReport(payload);
      show('扩展尚未加载实习自动代码，请先 reload', { ...payload, posted });
    } else {
      const posted = await postReport(result || { ok: false, reason: 'empty_response' });
      if (result?.helpNeeded) {
        show(`我需要帮助！ ${result.helpReason || result.reason || ''}`.trim(), { ...result, posted });
      } else if (result?.ok) {
        const stateLabel = result.job?.state ?? result.readiness?.rowCount ?? '?';
        show(`实习自动完成：mode=${result.mode || autoMode} bindOk=${result.bindOk} state=${stateLabel}`, { ...result, posted });
      } else {
        show(`实习自动失败：${result?.reason || 'unknown'}`, { ...result, posted });
      }
    }
  } catch (error) {
    const payload = { ok: false, reason: String(error?.message || error), helpNeeded: false };
    const posted = await postReport(payload);
    show(`实习自动异常：${payload.reason}`, { ...payload, posted });
  }
} else {
  show('正在请求后台 CMS_EDUCATION_AUTO_FILL…', { profileIndex, alsoProfileIndexes, replaceExisting, reportPort });
  await postEvent('fill_begin', { profileIndex, alsoProfileIndexes, replaceExisting });
  try {
    const result = await chrome.runtime.sendMessage({
      type: 'CMS_EDUCATION_AUTO_FILL',
      profileIndex,
      alsoProfileIndexes,
      replaceExisting
    });
    if (result == null) {
      const payload = {
        ok: false,
        reason: 'extension_reload_required',
        helpNeeded: false,
        hint: 'Service worker has no AUTO_FILL yet; run with mode=reload first'
      };
      const posted = await postReport(payload);
      show('扩展尚未加载自动填写代码，请先 reload', { ...payload, posted });
    } else {
      const posted = await postReport(result || { ok: false, reason: 'empty_response' });
      if (result?.helpNeeded) {
        show(`我需要帮助！ ${result.helpReason || result.reason || ''}`.trim(), { ...result, posted });
      } else if (result?.ok) {
        show(`自动填写完成：state=${result.job?.state || '?'} complete=${result.job?.complete}`, { ...result, posted });
      } else {
        show(`自动填写失败：${result?.reason || 'unknown'}`, { ...result, posted });
      }
    }
  } catch (error) {
    const payload = { ok: false, reason: String(error?.message || error), helpNeeded: false };
    const posted = await postReport(payload);
    show(`自动填写异常：${payload.reason}`, { ...payload, posted });
  }
}
